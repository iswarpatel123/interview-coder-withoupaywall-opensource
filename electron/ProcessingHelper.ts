// ProcessingHelper.ts
import * as axios from "axios";
import { BrowserWindow } from "electron";
import fs from "node:fs";
import path from "node:path";
import { OpenAI } from "openai";
import { configHelper } from "./ConfigHelper";
import { ScreenshotHelper } from "./ScreenshotHelper";
import { IProcessingHelperDeps } from "./main";

export interface ProblemInfo {
  problem_statement: string;
  constraints?: any;
  example_input?: any;
  example_output?: any;
  solution_stub?: any;
  notes?: any;
}

export interface DebugStateEntry {
  problemInfo: ProblemInfo;
  code: string;
  timestamp: number;
}

export interface DebugState {
  entries: DebugStateEntry[];
}

export class ProcessingHelper {
  private deps: IProcessingHelperDeps;
  private screenshotHelper: ScreenshotHelper;
  private aiClient: OpenAI | null = null;
  private debugStatePath: string;

  // AbortControllers for API requests
  private currentProcessingAbortController: AbortController | null = null;
  private currentExtraProcessingAbortController: AbortController | null = null;

  constructor(deps: IProcessingHelperDeps) {
    this.deps = deps;
    this.screenshotHelper = deps.getScreenshotHelper()!;
    
    // Initialize debug state path in userData directory
    const userDataPath = process.env.APPDATA || (process.platform === 'darwin' 
      ? path.join(process.env.HOME || '', 'Library', 'Application Support')
      : path.join(process.env.HOME || '', '.config'));
    this.debugStatePath = path.join(userDataPath, 'interview-coder', 'debugState.json');

    // Initialize AI clients based on config
    this.initializeAIClients();

    // Listen for config changes to re-initialize the AI clients
    configHelper.on("config-updated", () => {
      this.initializeAIClients();
    });
  }

  /**
   * Initialize or reinitialize the AI client with current config
   */
  private initializeAIClients(): void {
    try {
      const config = configHelper.loadConfig();

      // Initialize unified AI client
      if (config.aiApiKey && config.aiEndpoint) {
        this.aiClient = new OpenAI({
          apiKey: config.aiApiKey,
          baseURL: config.aiEndpoint,
          timeout: 60000,
          maxRetries: 2,
        });
        console.log("AI client initialized successfully");
      } else {
        this.aiClient = null;
        console.warn(
          "No AI API key or endpoint available, AI client not initialized",
        );
      }
    } catch (error) {
      console.error("Failed to initialize AI client:", error);
      this.aiClient = null;
    }
  }

  private async waitForInitialization(
    mainWindow: BrowserWindow,
  ): Promise<void> {
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds total

    while (attempts < maxAttempts) {
      const isInitialized = await mainWindow.webContents.executeJavaScript(
        "window.__IS_INITIALIZED__",
      );
      if (isInitialized) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }
    throw new Error("App failed to initialize after 5 seconds");
  }

  private async getCredits(): Promise<number> {
    const mainWindow = this.deps.getMainWindow();
    if (!mainWindow) return 999; // Unlimited credits in this version

    try {
      await this.waitForInitialization(mainWindow);
      return 999; // Always return sufficient credits to work
    } catch (error) {
      console.error("Error getting credits:", error);
      return 999; // Unlimited credits as fallback
    }
  }

  private async getLanguage(): Promise<string> {
    try {
      // Get language from config
      const config = configHelper.loadConfig();
      if (config.language) {
        return config.language;
      }

      // Fallback to window variable if config doesn't have language
      const mainWindow = this.deps.getMainWindow();
      if (mainWindow) {
        try {
          await this.waitForInitialization(mainWindow);
          const language = await mainWindow.webContents.executeJavaScript(
            "window.__LANGUAGE__",
          );

          if (
            typeof language === "string" &&
            language !== undefined &&
            language !== null
          ) {
            return language;
          }
        } catch (err) {
          console.warn("Could not get language from window", err);
        }
      }

      // Default fallback
      return "python";
    } catch (error) {
      console.error("Error getting language:", error);
      return "python";
    }
  }

  /**
   * Extract problem statement from the LLM response text
   */
  private extractProblemStatement(responseText: string): string | null {
    // Look for problem description in the response
    // Try to find text between CODE or THOUGHTS sections that might contain the problem
    const problemMatch = responseText.match(/problem[:\s]+([^\n]{20,500})/i);
    if (problemMatch) {
      return problemMatch[1].trim();
    }
    
    // If no explicit problem statement found, return null
    // The debug prompt will handle this gracefully
    return null;
  }

  /**
   * Save debug state to persistent storage
   */
  private saveDebugState(entry: DebugStateEntry): void {
    try {
      let state: DebugState = { entries: [] };
      
      // Load existing state if file exists
      if (fs.existsSync(this.debugStatePath)) {
        try {
          const existingData = fs.readFileSync(this.debugStatePath, 'utf-8');
          state = JSON.parse(existingData);
        } catch (e) {
          console.warn("Failed to parse existing debug state, starting fresh");
        }
      }
      
      // Clear existing entries and add new one (for fresh solution)
      state.entries = [entry];
      
      // Ensure directory exists
      const dir = path.dirname(this.debugStatePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(this.debugStatePath, JSON.stringify(state, null, 2));
      console.log("Debug state saved to:", this.debugStatePath);
    } catch (error) {
      console.error("Failed to save debug state:", error);
    }
  }

  /**
   * Append a new entry to the debug state (for follow-ups)
   */
  public appendDebugState(entry: DebugStateEntry): void {
    try {
      let state: DebugState = { entries: [] };
      
      // Load existing state if file exists
      if (fs.existsSync(this.debugStatePath)) {
        try {
          const existingData = fs.readFileSync(this.debugStatePath, 'utf-8');
          state = JSON.parse(existingData);
        } catch (e) {
          console.warn("Failed to parse existing debug state, starting fresh");
        }
      }
      
      // Append new entry
      state.entries.push(entry);
      
      fs.writeFileSync(this.debugStatePath, JSON.stringify(state, null, 2));
      console.log("Debug state appended, total entries:", state.entries.length);
    } catch (error) {
      console.error("Failed to append debug state:", error);
    }
  }

  /**
   * Load debug state from persistent storage
   */
  public loadDebugState(): DebugState | null {
    try {
      if (!fs.existsSync(this.debugStatePath)) {
        return null;
      }
      
      const data = fs.readFileSync(this.debugStatePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error("Failed to load debug state:", error);
      return null;
    }
  }

  /**
   * Clear debug state
   */
  public clearDebugState(): void {
    try {
      if (fs.existsSync(this.debugStatePath)) {
        fs.unlinkSync(this.debugStatePath);
        console.log("Debug state cleared");
      }
    } catch (error) {
      console.error("Failed to clear debug state:", error);
    }
  }

  /**
   * Check if there is a previous solution (for follow-up mode)
   */
  public hasPreviousSolution(): boolean {
    // Check if there are existing debug entries
    const existingState = this.loadDebugState();
    return existingState !== null && existingState.entries.length > 0;
  }

  public async processScreenshots(): Promise<void> {
    const mainWindow = this.deps.getMainWindow();
    if (!mainWindow) return;

    const config = configHelper.loadConfig();

    // First verify we have a valid AI client
    if (!config.aiApiKey || !this.aiClient) {
      this.initializeAIClients();

      if (!this.aiClient) {
        console.error("AI client not initialized");
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.API_KEY_INVALID,
        );
        return;
      }
    }

    const view = this.deps.getView();

    if (view === "queue") {
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.INITIAL_START);
      const screenshotQueue = this.screenshotHelper.getScreenshotQueue();

      if (!screenshotQueue || screenshotQueue.length === 0) {
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
        return;
      }

      const existingScreenshots = screenshotQueue.filter((path) =>
        fs.existsSync(path),
      );
      if (existingScreenshots.length === 0) {
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
        return;
      }

      try {
        // Initialize AbortController
        this.currentProcessingAbortController = new AbortController();
        const { signal } = this.currentProcessingAbortController;

        const screenshots = await Promise.all(
          existingScreenshots.map(async (path) => {
            try {
              return {
                path,
                preview: await this.screenshotHelper.getImagePreview(path),
                data: fs.readFileSync(path).toString("base64"),
              };
            } catch (err) {
              console.error(`Error reading screenshot ${path}:`, err);
              return null;
            }
          }),
        );

        // Filter out any nulls from failed screenshots
        const validScreenshots = screenshots.filter(
          (s): s is NonNullable<typeof s> => s !== null,
        );

        if (validScreenshots.length === 0) {
          throw new Error("Failed to load screenshot data");
        }

        const result = await this.processScreenshotsHelper(
          validScreenshots,
          signal,
        );

        if (!result.success) {
          console.log("Processing failed:", result.error);
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
            result.error,
          );
          this.deps.setView("queue");
          return;
        }

        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.SOLUTION_SUCCESS,
          result.data,
        );
        this.deps.setView("solutions");
      } catch (error: any) {
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
          error,
        );
        console.error("Processing error:", error);
        if (axios.isCancel(error)) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
            "Processing was canceled by the user.",
          );
        } else {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
            error.message || "Server error. Please try again.",
          );
        }
        this.deps.setView("queue");
      } finally {
        this.currentProcessingAbortController = null;
      }
    } else {
      // view == 'solutions'
      const extraScreenshotQueue =
        this.screenshotHelper.getExtraScreenshotQueue();
      if (!extraScreenshotQueue || extraScreenshotQueue.length === 0) {
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
        return;
      }

      const existingExtraScreenshots = extraScreenshotQueue.filter((path) =>
        fs.existsSync(path),
      );
      if (existingExtraScreenshots.length === 0) {
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
        return;
      }

      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.DEBUG_START);

      // Initialize AbortController
      this.currentExtraProcessingAbortController = new AbortController();
      const { signal } = this.currentExtraProcessingAbortController;

      try {
        // Get all screenshots (both main and extra) for processing
        const allPaths = [
          ...this.screenshotHelper.getScreenshotQueue(),
          ...existingExtraScreenshots,
        ];

        const screenshots = await Promise.all(
          allPaths.map(async (path) => {
            try {
              if (!fs.existsSync(path)) {
                console.warn(`Screenshot file does not exist: ${path}`);
                return null;
              }

              return {
                path,
                preview: await this.screenshotHelper.getImagePreview(path),
                data: fs.readFileSync(path).toString("base64"),
              };
            } catch (err) {
              console.error(`Error reading screenshot ${path}:`, err);
              return null;
            }
          }),
        );

        // Filter out any nulls from failed screenshots
        const validScreenshots = screenshots.filter(
          (s): s is NonNullable<typeof s> => s !== null,
        );

        if (validScreenshots.length === 0) {
          throw new Error("Failed to load screenshot data for debugging");
        }

        const result = await this.processExtraScreenshotsHelper(
          validScreenshots,
          signal,
        );

        if (result.success) {
          this.deps.setHasDebugged(true);
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_SUCCESS,
            result.data,
          );
        } else {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
            result.error,
          );
        }
      } catch (error: any) {
        if (axios.isCancel(error)) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
            "Extra processing was canceled by the user.",
          );
        } else {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
            error.message,
          );
        }
      } finally {
        this.currentExtraProcessingAbortController = null;
      }
    }
  }

  /**
   * Process follow-up screenshots with full context chaining
   */
  public async processFollowUp(): Promise<void> {
    const mainWindow = this.deps.getMainWindow();
    if (!mainWindow) return;

    const config = configHelper.loadConfig();

    // First verify we have a valid AI client
    if (!config.aiApiKey || !this.aiClient) {
      this.initializeAIClients();

      if (!this.aiClient) {
        console.error("AI client not initialized");
        if (mainWindow) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.API_KEY_INVALID,
          );
        }
        return;
      }
    }

    // Check if we have debug state (previous solution)
    const debugState = this.loadDebugState();
    if (!debugState || debugState.entries.length === 0) {
      console.log("No previous solution found, falling back to standard processing");
      await this.processScreenshots();
      return;
    }

    // Get extra screenshots for follow-up
    const extraScreenshotQueue = this.screenshotHelper.getExtraScreenshotQueue();
    if (!extraScreenshotQueue || extraScreenshotQueue.length === 0) {
      if (mainWindow) {
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
      }
      return;
    }

    const existingExtraScreenshots = extraScreenshotQueue.filter((path) =>
      fs.existsSync(path),
    );
    if (existingExtraScreenshots.length === 0) {
      if (mainWindow) {
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
      }
      return;
    }

    mainWindow?.webContents.send(this.deps.PROCESSING_EVENTS.DEBUG_START);

    // Initialize AbortController
    this.currentExtraProcessingAbortController = new AbortController();
    const { signal } = this.currentExtraProcessingAbortController;

    try {
      // Only use extra screenshots for follow-up (the new question/scenario)
      const screenshots = await Promise.all(
        existingExtraScreenshots.map(async (path) => {
          try {
            if (!fs.existsSync(path)) {
              console.warn(`Screenshot file does not exist: ${path}`);
              return null;
            }

            return {
              path,
              preview: await this.screenshotHelper.getImagePreview(path),
              data: fs.readFileSync(path).toString("base64"),
            };
          } catch (err) {
            console.error(`Error reading screenshot ${path}:`, err);
            return null;
          }
        }),
      );

      // Filter out any nulls from failed screenshots
      const validScreenshots = screenshots.filter(
        (s): s is NonNullable<typeof s> => s !== null,
      );

      if (validScreenshots.length === 0) {
        throw new Error("Failed to load screenshot data for follow-up");
      }

      // Process as follow-up with context chaining
      const result = await this.processExtraScreenshotsHelper(
        validScreenshots,
        signal,
        true, // isFollowUp = true
      );

      if (result.success) {
        this.deps.setHasDebugged(true);
        mainWindow?.webContents.send(
          this.deps.PROCESSING_EVENTS.DEBUG_SUCCESS,
          result.data,
        );
      } else {
        mainWindow?.webContents.send(
          this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
          result.error,
        );
      }
    } catch (error: any) {
      console.error("Follow-up processing error:", error);
      if (axios.isCancel(error)) {
        mainWindow?.webContents.send(
          this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
          "Follow-up processing was canceled by the user.",
        );
      } else {
        mainWindow?.webContents.send(
          this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
          error.message,
        );
      }
    } finally {
      this.currentExtraProcessingAbortController = null;
    }
  }

  private async processScreenshotsHelper(
    screenshots: Array<{ path: string; data: string }>,
    signal: AbortSignal,
  ) {
    try {
      const config = configHelper.loadConfig();
      const language = await this.getLanguage();
      const mainWindow = this.deps.getMainWindow();

      const imageDataList = screenshots.map((screenshot) => screenshot.data);

      if (!this.aiClient) {
        this.initializeAIClients();

        if (!this.aiClient) {
          return {
            success: false,
            error:
              "AI API key not configured or invalid. Please check your settings.",
          };
        }
      }

      const messages = [
        {
          role: "system" as const,
          content: `You are a coding interview assistant. Analyze the screenshots and provide a comprehensive solution in ${language}.`,
        },
        {
          role: "user" as const,
          content: [
            {
              type: "text" as const,
              text: `Analyze the coding problem from these screenshots and provide a complete solution in ${language}.

Your response must include:

1. CODE SOLUTION:
   - A clean, optimized implementation
   - Comments in code

2. THOUGHTS / DISCUSSION:
   2a. Precise followup questions to ask the interviewer
   2b. Solution approach(es). Brute force (if available for this case) & optimal. Format it in human spoken language which can be read word by word to the interviewer.
       eg. Brute Force : We can use TWO LOOPS TO ITERATE.. And we can find out the AREA FOR EVERY POSSIBLE COMBINATION..
           Optimal : We can use TWO POINTER..
       Balanced verbosity to understand the entire solution.
   2c. Solution walkthrough with the simplest case

3. COMPLEXITY ANALYSIS:
   - Time complexity with explanation
   - Space complexity with explanation

For complexity explanations, please be thorough. For example: "Time complexity: O(n) because we iterate through the array only once. This is optimal as we need to examine each element at least once to find the solution." or "Space complexity: O(n) because in the worst case, we store all elements in the hashmap. The additional space scales linearly with the input size."
Your solution should be efficient and handle edge cases.

Format your response as:
---CODE---
\`\`\`${language}
{your code here}
\`\`\`
---CODE---

---THOUGHTS---
{
  "questions_to_ask": ["question 1", "question 2"],
  "solution_approaches": ["approach 1 description", "approach 2 description"],
  "walkthrough": ["step 1", "step 2", "step 3"]
}
---THOUGHTS---

---COMPLEXITY---
Time complexity: {O(notation) - explanation}
Space complexity: {O(notation) - explanation}
---COMPLEXITY---`,
            },
            ...imageDataList.map((data) => ({
              type: "image_url" as const,
              image_url: { url: `data:image/png;base64,${data}` },
            })),
          ],
        },
      ];

      const response = await this.aiClient.chat.completions.create({
        model: config.aiModel || "gpt-4o",
        messages: messages,
        temperature: 0.2,
      });

      const responseText = response.choices[0].message.content || "";

      let code = "";
      let thoughts: string[] = [];
      let timeComplexity = "";
      let spaceComplexity = "";

      const codeMatch = responseText.match(/---CODE---([\s\S]*?)---CODE---/);
      if (codeMatch) {
        const innerCodeMatch = codeMatch[1].match(
          /```(?:\w+)?\s*([\s\S]*?)```/,
        );
        code = innerCodeMatch ? innerCodeMatch[1].trim() : codeMatch[1].trim();
      }

      const thoughtsMatch = responseText.match(
        /---THOUGHTS---([\s\S]*?)---THOUGHTS---/,
      );
      if (thoughtsMatch) {
        try {
          // Try to parse as JSON
          const thoughtsJson = JSON.parse(thoughtsMatch[1].trim());

          // Add each section as a structured thought
          if (
            thoughtsJson.questions_to_ask &&
            Array.isArray(thoughtsJson.questions_to_ask)
          ) {
            thoughtsJson.questions_to_ask.forEach((question: string) => {
              thoughts.push(`[QUESTIONS TO ASK] ${question}`);
            });
          }

          if (
            thoughtsJson.solution_approaches &&
            Array.isArray(thoughtsJson.solution_approaches)
          ) {
            thoughtsJson.solution_approaches.forEach((approach: string) => {
              thoughts.push(`[SOLUTION APPROACHES] ${approach}`);
            });
          }

          if (thoughtsJson.walkthrough) {
            thoughts.push(`[WALKTHROUGH] ${thoughtsJson.walkthrough}`);
          }

          console.log(
            "JSON parsing successful. Thoughts count:",
            thoughts.length,
          );
        } catch (e) {
          // Fallback to text parsing if JSON parsing fails
          console.log("JSON parsing failed, using fallback text parsing");
          const thoughtsContent = thoughtsMatch[1].trim();

          // Simple text-based parsing as fallback
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const _sections = [
            { name: "QUESTIONS TO ASK", regex: /- (.*)/g },
            { name: "SOLUTION APPROACHES", regex: /- (.*)/g },
            { name: "WALKTHROUGH", regex: /- (.*)/g },
          ];

          thoughts.push(`[SOLUTION APPROACHES] ${thoughtsContent}`);
        }
      }

      const complexityMatch = responseText.match(
        /---COMPLEXITY---([\s\S]*?)---COMPLEXITY---/,
      );
      if (complexityMatch) {
        const timeMatch = complexityMatch[1].match(
          /Time complexity:?\s*([^\n]+)/i,
        );
        if (timeMatch) timeComplexity = timeMatch[1].trim();

        const spaceMatch = complexityMatch[1].match(
          /Space complexity:?\s*([^\n]+)/i,
        );
        if (spaceMatch) spaceComplexity = spaceMatch[1].trim();
      }

      if (!timeComplexity) timeComplexity = "O(n) - Linear time complexity";
      if (!spaceComplexity) spaceComplexity = "O(n) - Linear space complexity";

      // Extract problem info from the response for debugging/follow-up
      const extractedProblemInfo: ProblemInfo = {
        problem_statement: this.extractProblemStatement(responseText) || "Problem statement not available",
        constraints: null,
        example_input: null,
        example_output: null,
        solution_stub: null,
        notes: null
      };

      // Store the initial problem info and code for debug/follow-up
      this.saveDebugState({
        problemInfo: extractedProblemInfo,
        code: code,
        timestamp: Date.now()
      });

      this.deps.setProblemInfo(extractedProblemInfo);

      const solutionData = {
        code: code,
        thoughts:
          thoughts.length > 0
            ? thoughts
            : ["Solution approach based on efficiency and readability"],
        time_complexity: timeComplexity,
        space_complexity: spaceComplexity,
      };

      this.screenshotHelper.clearExtraScreenshotQueue();

      if (mainWindow) {
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.SOLUTION_SUCCESS,
          solutionData,
        );
      }

      return { success: true, data: solutionData };
    } catch (error: unknown) {
      if (axios.isCancel(error)) {
        return {
          success: false,
          error: "Processing was canceled by the user.",
        };
      }

      const axiosError = error as { response?: { status?: number }; message?: string };
      if (axiosError.response?.status === 401) {
        return {
          success: false,
          error: "Invalid API key. Please check your settings.",
        };
      } else if (axiosError.response?.status === 429) {
        return {
          success: false,
          error:
            "API rate limit exceeded or insufficient credits. Please try again later.",
        };
      } else if (axiosError.response?.status === 500) {
        return {
          success: false,
          error: "Server error. Please try again later.",
        };
      }

      console.error("API Error Details:", error);
      return {
        success: false,
        error:
          axiosError.message || "Failed to process screenshots. Please try again.",
      };
    }
  }

  private async generateSolutionsHelper(signal: AbortSignal) {
    return {
      success: false,
      error:
        "Solution generation is now integrated with extraction. Use processScreenshotsHelper instead.",
    };
  }

  private async processExtraScreenshotsHelper(
    screenshots: Array<{ path: string; data: string }>,
    _signal: AbortSignal,
    isFollowUp: boolean = false,
  ) {
    try {
      // Load debug state for context
      const debugState = this.loadDebugState();
      const language = await this.getLanguage();
      const config = configHelper.loadConfig();

      // Get problem info from state or deps
      let problemInfo = this.deps.getProblemInfo();
      
      // If we have debug state, use the latest entry's problem info
      if (debugState && debugState.entries.length > 0) {
        const latestEntry = debugState.entries[debugState.entries.length - 1];
        problemInfo = latestEntry.problemInfo;
      }

      if (!problemInfo) {
        throw new Error("No problem info available. Please process the initial problem first.");
      }

      const imageDataList = screenshots.map((screenshot) => screenshot.data);

      let debugContent;

      if (!this.aiClient) {
        this.initializeAIClients();

        if (!this.aiClient) {
          return {
            success: false,
            error: "AI API key not configured. Please check your settings.",
          };
        }
      }

      // Build the context sections for the prompt
      let contextSections = "";

      if (isFollowUp && debugState && debugState.entries.length > 0) {
        // Build chained context for follow-up questions
        contextSections = debugState.entries.map((entry, index) => {
          return `
### PREVIOUS PROBLEM INFO ${index + 1}
${entry.problemInfo.problem_statement || "Problem statement not available"}

### PREVIOUS CODE ${index + 1}
\`\`\`${language}
${entry.code}
\`\`\`
`;
        }).join("\n");
      } else {
        // Standard debug mode - show previous solution and problem info
        if (debugState && debugState.entries.length > 0) {
          const latestEntry = debugState.entries[debugState.entries.length - 1];
          contextSections = `
### PREVIOUS SOLUTION
\`\`\`${language}
${latestEntry.code}
\`\`\`

### PROBLEM INFO
${latestEntry.problemInfo.problem_statement || "Problem statement not available"}
`;
        } else {
          contextSections = `
### PROBLEM INFO
${problemInfo.problem_statement || "Problem statement not available"}
`;
        }
      }

      const userPromptText = isFollowUp
        ? `I have a follow-up question related to the problem below. Please consider the previous context and provide an updated solution.

${contextSections}

### CURRENT SCREENSHOT / NEW QUESTION
Please analyze this new screenshot and provide an updated solution that addresses the follow-up question or scenario shown.`
        : `I need help with debugging or improving my solution in ${language}.

${contextSections}

### CURRENT SCREENSHOT
Here are screenshots of my code, the errors or test cases. Please provide a detailed analysis with:
1. What issues you found in my code
2. Specific improvements and corrections
3. Any optimizations that would make the solution better
4. A clear explanation of the changes needed`;

      const messages = [
        {
          role: "system" as const,
          content: `You are a coding interview assistant helping debug and improve solutions. 
${isFollowUp 
  ? `This is a follow-up question. Analyze the previous context and the new screenshot to provide an updated solution.`
  : `Analyze these screenshots which include either error messages, incorrect outputs, or test cases, and provide detailed debugging help.`}

Your response MUST follow this exact structure with these section headers (use ### for headers):
### Issues Identified
- List each issue as a bullet point with clear explanation

### Specific Improvements and Corrections
- List specific code changes needed as bullet points

### Optimizations
- List any performance optimizations if applicable

### Explanation of Changes Needed
Here provide a clear explanation of why the changes are needed

### Updated Code Solution
\`\`\`${language}
{your updated code here}
\`\`\`

### Key Points
- Summary bullet points of the most important takeaways

If you include code examples, use proper markdown code blocks with language specification (e.g. \`\`\`java).`,
        },
        {
          role: "user" as const,
          content: [
            {
              type: "text" as const,
              text: userPromptText,
            },
            ...imageDataList.map((data) => ({
              type: "image_url" as const,
              image_url: { url: `data:image/png;base64,${data}` },
            })),
          ],
        },
      ];

      const debugResponse = await this.aiClient.chat.completions.create({
        model: config.aiModel || "gpt-4o",
        messages: messages,
        temperature: 0.2,
      });

      debugContent = debugResponse.choices[0].message.content || "";

      let extractedCode = isFollowUp ? "" : "// Debug mode - see analysis below";
      const codeMatch = debugContent.match(/```(?:[a-zA-Z]+)?([\s\S]*?)```/);
      if (codeMatch && codeMatch[1]) {
        // Get the last code block (updated solution should be at the end)
        const codeBlocks = debugContent.match(/```(?:[a-zA-Z]+)?[\s\S]*?```/g);
        if (codeBlocks && codeBlocks.length > 0) {
          const lastBlock = codeBlocks[codeBlocks.length - 1];
          const lastCodeMatch = lastBlock.match(/```(?:[a-zA-Z]+)?([\s\S]*?)```/);
          extractedCode = lastCodeMatch ? lastCodeMatch[1].trim() : extractedCode;
        } else {
          extractedCode = codeMatch[1].trim();
        }
      }

      let formattedDebugContent = debugContent;

      if (!debugContent.includes("# ") && !debugContent.includes("## ")) {
        formattedDebugContent = debugContent
          .replace(
            /issues identified|problems found|bugs found/i,
            "## Issues Identified",
          )
          .replace(
            /code improvements|improvements|suggested changes/i,
            "## Code Improvements",
          )
          .replace(
            /optimizations|performance improvements/i,
            "## Optimizations",
          )
          .replace(/explanation|detailed analysis/i, "## Explanation");
      }

      const bulletPoints = formattedDebugContent.match(
        /(?:^|\n)[ ]*(?:[-*•]|\d+\.)[ ]+([^\n]+)/g,
      );
      const thoughts = bulletPoints
        ? bulletPoints
            .map((point: string) =>
              point.replace(/^[ ]*(?:[-*•]|\d+\.)[ ]+/, "").trim(),
            )
            .slice(0, 5)
        : [isFollowUp 
            ? "Follow-up analysis based on your screenshots" 
            : "Debug analysis based on your screenshots"];

      // For follow-ups, also save the new solution to the debug state
      if (isFollowUp && extractedCode) {
        this.appendDebugState({
          problemInfo: problemInfo,
          code: extractedCode,
          timestamp: Date.now()
        });
      }

      const response = {
        code: extractedCode || "// No code changes needed - see analysis below",
        debug_analysis: formattedDebugContent,
        thoughts: thoughts,
        time_complexity: isFollowUp ? "See updated solution" : "N/A - Debug mode",
        space_complexity: isFollowUp ? "See updated solution" : "N/A - Debug mode",
        isFollowUp: isFollowUp,
      };

      return { success: true, data: response };
    } catch (error: any) {
      console.error("Debug processing error:", error);
      return {
        success: false,
        error: error.message || "Failed to process debug request",
      };
    }
  }

  public cancelOngoingRequests(): void {
    let wasCancelled = false;

    if (this.currentProcessingAbortController) {
      this.currentProcessingAbortController.abort();
      this.currentProcessingAbortController = null;
      wasCancelled = true;
    }

    if (this.currentExtraProcessingAbortController) {
      this.currentExtraProcessingAbortController.abort();
      this.currentExtraProcessingAbortController = null;
      wasCancelled = true;
    }

    this.deps.setHasDebugged(false);

    this.deps.setProblemInfo(null);

    // Also clear the debug state file
    this.clearDebugState();

    const mainWindow = this.deps.getMainWindow();
    if (wasCancelled && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
    }
  }
}
