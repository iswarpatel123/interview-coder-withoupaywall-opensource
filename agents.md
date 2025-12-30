# Agent Guide: Interview Coder Open-Source

Welcome agent. This document provides the essential context and architectural map to help you navigate and modify this codebase efficiently.

## 🚀 Project Overview
**Interview Coder** is an Electron-based desktop application designed to assist users during coding interviews. It captures screenshots of problem descriptions, uses Vision AI to extract structured information, and generates optimal solutions in various programming languages.

## 🏗️ Architecture

### 1. Main Process (`/electron`)
The main process handles system-level operations: window management, screenshots, file system access, and external API calls.

- **`main.ts`**: The entry point. Manages application state, window lifecycle, and initializes all helpers.
- **`ProcessingHelper.ts`**: **The Core Logic.** Handles AI interactions with OpenAI, Gemini, and Anthropic. It contains prompts for extraction and solution generation.
- **`ScreenshotHelper.ts`**: Manages screenshot capture, image previews, and the screenshot queues (Main and Extra/Debug).
- **`ConfigHelper.ts`**: Manages configuration persistence (API keys, model selections, UI opacity).
- **`ipcHandlers.ts`**: Defines the bridge between Main and Renderer processes.
- **`preload.ts`**: Exposes the `electronAPI` to the renderer via `contextBridge`.

### 2. Renderer Process (`/src`)
A React + Vite application that provides the user interface.

- **`App.tsx`**: Root component. Contains global listeners for IPC events and manages initial setup.
- **`_pages/`**:
    - `Queue.tsx`: The initial screen where users take/manage screenshots.
    - `Solutions.tsx`: Displays the extracted problem and the generated solution.
    - `Debug.tsx`: Specialized view for iterating on a solution with extra screenshots (errors/test cases).
- **`types/solutions.ts`**: Important TypeScript interfaces for the problem and solution data structures.

## 🔄 Core Workflows

### The "Process" Flow
1. **Trigger**: User clicks "Solve" in the UI.
2. **IPC Call**: `trigger-process-screenshots` is called.
3. **Extraction**: `ProcessingHelper.processScreenshots()` sends images to Vision AI.
4. **Data Sync**: Problem info is extracted into a `ProblemStatementData` object.
5. **Solution**: A second AI call generates the code, thoughts, and complexity analysis.
6. **UI Update**: `SOLUTION_SUCCESS` event is sent to the renderer.

### View Switching
The app operates in three main views:
- `queue`: Collecting initial screenshots.
- `solutions`: Viewing the initial result.
- `debug`: Refining the solution with extra context.

## 🛠️ Key Modification Points

### Changing AI Behavior
If you need to update prompts or how models are selected, look at:
- `electron/ProcessingHelper.ts` -> `processScreenshotsHelper` (Extraction)
- `electron/ProcessingHelper.ts` -> `generateSolutionsHelper` (Solution Generation)

### Updating Extracted Fields
To add new fields to the extraction process:
1. Update `src/types/solutions.ts` -> `ProblemStatementData`.
2. Update prompts in `ProcessingHelper.ts`.
3. Update `src/_pages/Solutions.tsx` to display the new data.

### Adding IPC Methods
1. Add function to `IIpcHandlerDeps` in `electron/main.ts`.
2. Implement handler in `electron/ipcHandlers.ts`.
3. Expose method in `electron/preload.js`.
4. Update `src/vite-env.d.ts` if necessary (though usually inferred from `preload`).

## 🎨 UI & Styling
- **CSS**: The project uses **Vanilla CSS** and **Tailwind CSS**.
- **Theming**: Dark mode is the primary aesthetic. Custom styling is concentrated in `src/index.css`.
- **Components**: UI components are located in `src/components/ui`.

## 🤖 State Management
- **Main Process**: Uses a central `state` object in `main.ts`.
- **Renderer Process**: Uses **TanStack Query** (React Query) for managing AI-generated data and screenshots. Key query keys: `["problem_statement"]`, `["solution"]`, `["new_solution"]`.

## 📝 Development Notes
- **Hot Reload**: Both Electron and React support HMR.
- **Dev Tools**: Enabled by default in development mode.
- **Transparency**: The main window is transparent and supports click-through/ignore-mouse-events patterns.
