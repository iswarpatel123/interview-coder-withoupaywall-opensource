// ProcessingHelper.ts
import * as axios from "axios"
import { BrowserWindow } from "electron"
import fs from "node:fs"
import { OpenAI } from "openai"
import { configHelper } from "./ConfigHelper"
import { ScreenshotHelper } from "./ScreenshotHelper"
import { IProcessingHelperDeps } from "./main"

export class ProcessingHelper {
  private deps: IProcessingHelperDeps
  private screenshotHelper: ScreenshotHelper
  private aiClient: OpenAI | null = null

  // AbortControllers for API requests
  private currentProcessingAbortController: AbortController | null = null
  private currentExtraProcessingAbortController: AbortController | null = null

  constructor(deps: IProcessingHelperDeps) {
    this.deps = deps
    this.screenshotHelper = deps.getScreenshotHelper()!

    // Initialize AI clients based on config
    this.initializeAIClients();

    // Listen for config changes to re-initialize the AI clients
    configHelper.on('config-updated', () => {
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
          maxRetries: 2
        });
        console.log("AI client initialized successfully");
      } else {
        this.aiClient = null;
        console.warn("No AI API key or endpoint available, AI client not initialized");
      }
    } catch (error) {
      console.error("Failed to initialize AI client:", error);
      this.aiClient = null;
    }
  }

  private async waitForInitialization(
    mainWindow: BrowserWindow
  ): Promise<void> {
    let attempts = 0
    const maxAttempts = 50 // 5 seconds total

    while (attempts < maxAttempts) {
      const isInitialized = await mainWindow.webContents.executeJavaScript(
        "window.__IS_INITIALIZED__"
      )
      if (isInitialized) return
      await new Promise((resolve) => setTimeout(resolve, 100))
      attempts++
    }
    throw new Error("App failed to initialize after 5 seconds")
  }

  private async getCredits(): Promise<number> {
    const mainWindow = this.deps.getMainWindow()
    if (!mainWindow) return 999 // Unlimited credits in this version

    try {
      await this.waitForInitialization(mainWindow)
      return 999 // Always return sufficient credits to work
    } catch (error) {
      console.error("Error getting credits:", error)
      return 999 // Unlimited credits as fallback
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
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow) {
        try {
          await this.waitForInitialization(mainWindow)
          const language = await mainWindow.webContents.executeJavaScript(
            "window.__LANGUAGE__"
          )

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
      console.error("Error getting language:", error)
      return "python"
    }
  }

  public async processScreenshots(): Promise<void> {
    const mainWindow = this.deps.getMainWindow()
    if (!mainWindow) return

    const config = configHelper.loadConfig();

    // First verify we have a valid AI client
    if (!config.aiApiKey || !this.aiClient) {
      this.initializeAIClients();

      if (!this.aiClient) {
        console.error("AI client not initialized");
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.API_KEY_INVALID
        );
        return;
      }
    }

    const view = this.deps.getView()
    console.log("Processing screenshots in view:", view)

    if (view === "queue") {
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.INITIAL_START)
      const screenshotQueue = this.screenshotHelper.getScreenshotQueue()
      console.log("Processing main queue screenshots:", screenshotQueue)

      // Check if the queue is empty
      if (!screenshotQueue || screenshotQueue.length === 0) {
        console.log("No screenshots found in queue");
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
        return;
      }

      // Check that files actually exist
      const existingScreenshots = screenshotQueue.filter(path => fs.existsSync(path));
      if (existingScreenshots.length === 0) {
        console.log("Screenshot files don't exist on disk");
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
        return;
      }

      try {
        // Initialize AbortController
        this.currentProcessingAbortController = new AbortController()
        const { signal } = this.currentProcessingAbortController

        const screenshots = await Promise.all(
          existingScreenshots.map(async (path) => {
            try {
              return {
                path,
                preview: await this.screenshotHelper.getImagePreview(path),
                data: fs.readFileSync(path).toString('base64')
              };
            } catch (err) {
              console.error(`Error reading screenshot ${path}:`, err);
              return null;
            }
          })
        )

        // Filter out any nulls from failed screenshots
        const validScreenshots = screenshots.filter((s): s is NonNullable<typeof s> => s !== null);

        if (validScreenshots.length === 0) {
          throw new Error("Failed to load screenshot data");
        }

        const result = await this.processScreenshotsHelper(validScreenshots, signal)

        if (!result.success) {
          console.log("Processing failed:", result.error)
          if (result.error?.includes("API Key") || result.error?.includes("OpenAI")) {
            mainWindow.webContents.send(
              this.deps.PROCESSING_EVENTS.API_KEY_INVALID
            )
          } else {
            mainWindow.webContents.send(
              this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
              result.error
            )
          }
          // Reset view back to queue on error
          console.log("Resetting view to queue due to error")
          this.deps.setView("queue")
          return
        }

        // Only set view to solutions if processing succeeded
        console.log("Setting view to solutions after successful processing")
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.SOLUTION_SUCCESS,
          result.data
        )
        this.deps.setView("solutions")
      } catch (error: any) {
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
          error
        )
        console.error("Processing error:", error)
        if (axios.isCancel(error)) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
            "Processing was canceled by the user."
          )
        } else {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
            error.message || "Server error. Please try again."
          )
        }
        // Reset view back to queue on error
        console.log("Resetting view to queue due to error")
        this.deps.setView("queue")
      } finally {
        this.currentProcessingAbortController = null
      }
    } else {
      // view == 'solutions'
      const extraScreenshotQueue =
        this.screenshotHelper.getExtraScreenshotQueue()
      console.log("Processing extra queue screenshots:", extraScreenshotQueue)

      // Check if the extra queue is empty
      if (!extraScreenshotQueue || extraScreenshotQueue.length === 0) {
        console.log("No extra screenshots found in queue");
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);

        return;
      }

      // Check that files actually exist
      const existingExtraScreenshots = extraScreenshotQueue.filter(path => fs.existsSync(path));
      if (existingExtraScreenshots.length === 0) {
        console.log("Extra screenshot files don't exist on disk");
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
        return;
      }

      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.DEBUG_START)

      // Initialize AbortController
      this.currentExtraProcessingAbortController = new AbortController()
      const { signal } = this.currentExtraProcessingAbortController

      try {
        // Get all screenshots (both main and extra) for processing
        const allPaths = [
          ...this.screenshotHelper.getScreenshotQueue(),
          ...existingExtraScreenshots
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
                data: fs.readFileSync(path).toString('base64')
              };
            } catch (err) {
              console.error(`Error reading screenshot ${path}:`, err);
              return null;
            }
          })
        )

        // Filter out any nulls from failed screenshots
        const validScreenshots = screenshots.filter((s): s is NonNullable<typeof s> => s !== null);

        if (validScreenshots.length === 0) {
          throw new Error("Failed to load screenshot data for debugging");
        }

        console.log(
          "Combined screenshots for processing:",
          validScreenshots.map((s) => s.path)
        )

        const result = await this.processExtraScreenshotsHelper(
          validScreenshots,
          signal
        )

        if (result.success) {
          this.deps.setHasDebugged(true)
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_SUCCESS,
            result.data
          )
        } else {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
            result.error
          )
        }
      } catch (error: any) {
        if (axios.isCancel(error)) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
            "Extra processing was canceled by the user."
          )
        } else {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
            error.message
          )
        }
      } finally {
        this.currentExtraProcessingAbortController = null
      }
    }
  }

  private async processScreenshotsHelper(
    screenshots: Array<{ path: string; data: string }>,
    signal: AbortSignal
  ) {
    try {
      const config = configHelper.loadConfig();
      const language = await this.getLanguage();
      const mainWindow = this.deps.getMainWindow();

      const imageDataList = screenshots.map(screenshot => screenshot.data);

      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Analyzing screenshots and generating solution...",
          progress: 20
        });
      }

      if (!this.aiClient) {
        this.initializeAIClients();

        if (!this.aiClient) {
          return {
            success: false,
            error: "AI API key not configured or invalid. Please check your settings."
          };
        }
      }

      const messages = [
        {
          role: "system" as const,
          content: `You are a coding interview assistant. Analyze the screenshots and provide a comprehensive solution in ${language}.`
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
   - Follow the solution stub structure if provided
   - Comments in code

2. THOUGHTS / DISCUSSION:
   - Precise followup questions to ask the interviewer
   - Solution approach(es). Brute force (if available for this case) & optimal
   - Solution walkthrough with the simplest case
   - Edge cases to consider

3. COMPLEXITY ANALYSIS:
   - Time complexity with detailed explanation (at least 2 sentences)
   - Space complexity with detailed explanation (at least 2 sentences)

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
  "walkthrough": ["step 1", "step 2", "step 3"],
  "edge_cases": ["edge case 1", "edge case 2"]
}
---THOUGHTS---

---COMPLEXITY---
Time complexity: {O(notation) - detailed explanation}
Space complexity: {O(notation) - detailed explanation}
---COMPLEXITY---`
            },
            ...imageDataList.map(data => ({
              type: "image_url" as const,
              image_url: { url: `data:image/png;base64,${data}` }
            }))
          ]
        }
      ];

      const response = await this.aiClient.chat.completions.create({
        model: config.aiModel || "gpt-4o",
        messages: messages,
        temperature: 0.2
      });

      const responseText = response.choices[0].message.content || "";

      let problemInfo: any = null;
      let code = "";
      let thoughts: string[] = [];
      let timeComplexity = "";
      let spaceComplexity = "";

      const codeMatch = responseText.match(/---CODE---([\s\S]*?)---CODE---/);
      if (codeMatch) {
        const innerCodeMatch = codeMatch[1].match(/```(?:\w+)?\s*([\s\S]*?)```/);
        code = innerCodeMatch ? innerCodeMatch[1].trim() : codeMatch[1].trim();
      }

      const thoughtsMatch = responseText.match(/---THOUGHTS---([\s\S]*?)---THOUGHTS---/);
      if (thoughtsMatch) {
        try {
          // Try to parse as JSON
          const thoughtsJson = JSON.parse(thoughtsMatch[1].trim());

          // Add each section as a structured thought
          if (thoughtsJson.questions_to_ask && Array.isArray(thoughtsJson.questions_to_ask)) {
            thoughtsJson.questions_to_ask.forEach((question: string) => {
              thoughts.push(`[QUESTIONS TO ASK] ${question}`);
            });
          }

          if (thoughtsJson.solution_approaches && Array.isArray(thoughtsJson.solution_approaches)) {
            thoughtsJson.solution_approaches.forEach((approach: string) => {
              thoughts.push(`[SOLUTION APPROACHES] ${approach}`);
            });
          }

          if (thoughtsJson.walkthrough) {
            thoughts.push(`[WALKTHROUGH] ${thoughtsJson.walkthrough}`);
          }

          if (thoughtsJson.edge_cases && Array.isArray(thoughtsJson.edge_cases)) {
            thoughtsJson.edge_cases.forEach((edgeCase: string) => {
              thoughts.push(`[EDGE CASES] ${edgeCase}`);
            });
          }

          console.log("JSON parsing successful. Thoughts count:", thoughts.length);
        } catch (e) {
          // Fallback to text parsing if JSON parsing fails
          console.log("JSON parsing failed, using fallback text parsing");
          const thoughtsContent = thoughtsMatch[1].trim();

          // Simple text-based parsing as fallback
          const sections = [
            { name: 'QUESTIONS TO ASK', regex: /- (.*)/g },
            { name: 'SOLUTION APPROACHES', regex: /- (.*)/g },
            { name: 'WALKTHROUGH', regex: /- (.*)/g },
            { name: 'EDGE CASES', regex: /- (.*)/g }
          ];

          thoughts.push(`[SOLUTION APPROACHES] ${thoughtsContent}`);
        }
      }

      const complexityMatch = responseText.match(/---COMPLEXITY---([\s\S]*?)---COMPLEXITY---/);
      if (complexityMatch) {
        const timeMatch = complexityMatch[1].match(/Time complexity:?\s*([^\n]+)/i);
        if (timeMatch) timeComplexity = timeMatch[1].trim();

        const spaceMatch = complexityMatch[1].match(/Space complexity:?\s*([^\n]+)/i);
        if (spaceMatch) spaceComplexity = spaceMatch[1].trim();
      }

      if (!timeComplexity) timeComplexity = "O(n) - Linear time complexity";
      if (!spaceComplexity) spaceComplexity = "O(n) - Linear space complexity";

      this.deps.setProblemInfo(problemInfo);

      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Solution generated successfully",
          progress: 100
        });

        const solutionData = {
          code: code,
          thoughts: thoughts.length > 0 ? thoughts : ["Solution approach based on efficiency and readability"],
          time_complexity: timeComplexity,
          space_complexity: spaceComplexity
        };

        this.screenshotHelper.clearExtraScreenshotQueue();

        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.SOLUTION_SUCCESS,
          solutionData
        );

        return { success: true, data: solutionData };
      }

      return { success: false, error: "Failed to process screenshots" };
    } catch (error: any) {
      if (axios.isCancel(error)) {
        return {
          success: false,
          error: "Processing was canceled by the user."
        };
      }

      if (error?.response?.status === 401) {
        return {
          success: false,
          error: "Invalid API key. Please check your settings."
        };
      } else if (error?.response?.status === 429) {
        return {
          success: false,
          error: "API rate limit exceeded or insufficient credits. Please try again later."
        };
      } else if (error?.response?.status === 500) {
        return {
          success: false,
          error: "Server error. Please try again later."
        };
      }

      console.error("API Error Details:", error);
      return {
        success: false,
        error: error.message || "Failed to process screenshots. Please try again."
      };
    }
  }

  private async generateSolutionsHelper(signal: AbortSignal) {
    return {
      success: false,
      error: "Solution generation is now integrated with extraction. Use processScreenshotsHelper instead."
    };
  }

  private async processExtraScreenshotsHelper(
    screenshots: Array<{ path: string; data: string }>,
    signal: AbortSignal
  ) {
    try {
      const problemInfo = this.deps.getProblemInfo();
      const language = await this.getLanguage();
      const config = configHelper.loadConfig();
      const mainWindow = this.deps.getMainWindow();

      if (!problemInfo) {
        throw new Error("No problem info available");
      }

      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Processing debug screenshots...",
          progress: 30
        });
      }

      const imageDataList = screenshots.map(screenshot => screenshot.data);

      let debugContent;

      if (!this.aiClient) {
        this.initializeAIClients();

        if (!this.aiClient) {
          return {
            success: false,
            error: "AI API key not configured. Please check your settings."
          };
        }
      }

      const messages = [
        {
          role: "system" as const,
          content: `You are a coding interview assistant helping debug and improve solutions. Analyze these screenshots which include either error messages, incorrect outputs, or test cases, and provide detailed debugging help.

Your response MUST follow this exact structure with these section headers (use ### for headers):
### Issues Identified
- List each issue as a bullet point with clear explanation

### Specific Improvements and Corrections
- List specific code changes needed as bullet points

### Optimizations
- List any performance optimizations if applicable

### Explanation of Changes Needed
Here provide a clear explanation of why the changes are needed

### Key Points
- Summary bullet points of the most important takeaways

If you include code examples, use proper markdown code blocks with language specification (e.g. \`\`\`java).`
        },
        {
          role: "user" as const,
          content: [
            {
              type: "text" as const,
              text: `I need help with debugging or improving my solution in ${language}. 
${problemInfo ? `The problem I'm solving is: "${problemInfo.problem_statement}"
Constraints: ${problemInfo.constraints || "No specific constraints provided."}
Solution Stub: ${problemInfo.solution_stub || "No solution stub provided."}
Notes: ${problemInfo.notes || "No additional notes provided."}` : ''}

I need help with debugging or improving my solution. Here are screenshots of my code, the errors or test cases. Please provide a detailed analysis with:
1. What issues you found in my code
2. Specific improvements and corrections
3. Any optimizations that would make the solution better
4. A clear explanation of the changes needed`
            },
            ...imageDataList.map(data => ({
              type: "image_url" as const,
              image_url: { url: `data:image/png;base64,${data}` }
            }))
          ]
        }
      ];

      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Analyzing code and generating debug feedback...",
          progress: 60
        });
      }

      const debugResponse = await this.aiClient.chat.completions.create({
        model: config.aiModel || "gpt-4o",
        messages: messages,
        temperature: 0.2
      });

      debugContent = debugResponse.choices[0].message.content || "";

      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Debug analysis complete",
          progress: 100
        });
      }

      let extractedCode = "// Debug mode - see analysis below";
      const codeMatch = debugContent.match(/```(?:[a-zA-Z]+)?([\s\S]*?)```/);
      if (codeMatch && codeMatch[1]) {
        extractedCode = codeMatch[1].trim();
      }

      let formattedDebugContent = debugContent;

      if (!debugContent.includes('# ') && !debugContent.includes('## ')) {
        formattedDebugContent = debugContent
          .replace(/issues identified|problems found|bugs found/i, '## Issues Identified')
          .replace(/code improvements|improvements|suggested changes/i, '## Code Improvements')
          .replace(/optimizations|performance improvements/i, '## Optimizations')
          .replace(/explanation|detailed analysis/i, '## Explanation');
      }

      const bulletPoints = formattedDebugContent.match(/(?:^|\n)[ ]*(?:[-*•]|\d+\.)[ ]+([^\n]+)/g);
      const thoughts = bulletPoints
        ? bulletPoints.map((point: string) => point.replace(/^[ ]*(?:[-*•]|\d+\.)[ ]+/, '').trim()).slice(0, 5)
        : ["Debug analysis based on your screenshots"];

      const response = {
        code: extractedCode,
        debug_analysis: formattedDebugContent,
        thoughts: thoughts,
        time_complexity: "N/A - Debug mode",
        space_complexity: "N/A - Debug mode"
      };

      return { success: true, data: response };
    } catch (error: any) {
      console.error("Debug processing error:", error);
      return { success: false, error: error.message || "Failed to process debug request" };
    }
  }

  public cancelOngoingRequests(): void {
    let wasCancelled = false

    if (this.currentProcessingAbortController) {
      this.currentProcessingAbortController.abort()
      this.currentProcessingAbortController = null
      wasCancelled = true
    }

    if (this.currentExtraProcessingAbortController) {
      this.currentExtraProcessingAbortController.abort()
      this.currentExtraProcessingAbortController = null
      wasCancelled = true
    }

    this.deps.setHasDebugged(false)

    this.deps.setProblemInfo(null)

    const mainWindow = this.deps.getMainWindow()
    if (wasCancelled && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS)
    }
  }
}