# Interview Assistant - Developer Guide

## 🚀 Project Overview

**Interview Assistant** is an Electron-based desktop application designed to help you during coding interviews. It displays customizable reference pages with text content and images that you can navigate through quickly and discreetly.

## 📦 Tech Stack

- **Electron 29**: Desktop application framework
- **React 18**: UI library
- **Vite**: Build tool and dev server
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Styling

## 🏗️ Architecture

### Directory Structure

```
/
├── electron/              # Main process code
│   ├── main.ts           # Application entry point
│   ├── preload.ts        # IPC bridge (contextBridge)
│   ├── ipcHandlers.ts    # IPC handlers for renderer communication
│   ├── shortcuts.ts      # Global keyboard shortcuts
│   └── ...              # Other helper files
├── src/                  # Renderer process (React UI)
│   ├── App.tsx          # Root React component
│   ├── _pages/          # Page components
│   │   ├── LocalPages.tsx    # Main page viewer
│   │   └── SubscribedApp.tsx # App wrapper
│   ├── components/      # Reusable UI components
│   └── ...
├── pages/               # Your content pages
│   ├── page1/
│   │   ├── content.txt  # Text content
│   │   └── image.svg    # Image (PNG, JPG, SVG, etc.)
│   ├── page2/
│   │   ├── content.txt
│   │   └── image.svg
│   └── ...
└── stealth-run.bat      # Launch script
```

### Main Process (`/electron`)

The main process handles all system-level operations:

- **`main.ts`**: Creates and manages the transparent, always-on-top window
- **`shortcuts.ts`**: Registers global keyboard shortcuts
- **`ipcHandlers.ts`**: Handles communication between main and renderer processes
- **`preload.ts`**: Exposes secure IPC methods to the renderer via contextBridge

### Renderer Process (`/src`)

The renderer is a React application that displays your content:

- **`App.tsx`**: Root component with QueryClient provider
- **`_pages/LocalPages.tsx`**: Main component that loads and displays pages
- **`_pages/SubscribedApp.tsx`**: Wrapper component that manages window sizing

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt + B` | Toggle window visibility (show/hide) |
| `Alt + Left` | Navigate to previous page |
| `Alt + Right` | Navigate to next page |
| `Ctrl + Arrow Keys` | Move window around the screen |
| `Ctrl + [` / `Ctrl + ]` | Decrease/increase opacity |
| `Ctrl + -` / `Ctrl + =` / `Ctrl + 0` | Zoom out/in/reset |
| `Ctrl + Q` | Quit application |

## 📄 Creating Pages

Each page is a folder inside the `pages/` directory. Here's how to create a new page:

### Step 1: Create a Page Folder

Create a new folder in the `pages/` directory. The folder name will be used as the page title (with underscores/hyphens converted to spaces and capitalized).

```
pages/
└── my-new-page/
```

### Step 2: Add Content

Inside your page folder, create two files:

1. **`content.txt`** - Your text content (required)
2. **`image.[png|jpg|svg|gif]`** - An image (optional)

Example structure:

```
pages/
└── algorithms-cheatsheet/
    ├── content.txt
    └── image.png
```

### Content File Format

The `content.txt` file should contain plain text. It will be displayed with preserved line breaks and spacing:

```
Algorithm Complexity Cheat Sheet

Sorting Algorithms:
- Bubble Sort: O(n²)
- Quick Sort: O(n log n) average
- Merge Sort: O(n log n)

Common Patterns:
- Two Pointers
- Sliding Window
- Binary Search
```

### Image Requirements

- **Supported formats**: PNG, JPG, JPEG, SVG, GIF
- **Recommended size**: 400-800px wide
- **File name**: Any name with a supported extension (e.g., `diagram.png`, `image.svg`)

## 🚀 Running the Application

### Development Mode

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the dev server:
   ```bash
   npm run dev
   ```

### Production Mode

Run the application using the stealth launcher:

**Windows:**
```bash
stealth-run.bat
```

**Linux/Mac:**
```bash
./stealth-run.sh
```

The stealth launcher runs the app without showing a terminal window.

## 🔧 Configuration

### Window Settings

The window is configured to be:
- **Transparent**: Background is transparent
- **Always on top**: Stays above other windows
- **Frameless**: No title bar or window controls
- **Content protected**: Won't appear in screenshots/recordings (platform-dependent)

These settings are defined in `electron/main.ts` in the `createWindow()` function.

### Modifying Keyboard Shortcuts

To change keyboard shortcuts, edit `electron/shortcuts.ts`:

```typescript
globalShortcut.register("Alt+B", () => {
  this.deps.toggleMainWindow()
})
```

Available modifiers: `CommandOrControl`, `Alt`, `Shift`, `Super`

## 🛠️ Development Guide

### Adding New Features

#### 1. Adding IPC Methods

To add communication between main and renderer:

**Step 1:** Add handler in `electron/ipcHandlers.ts`:
```typescript
ipcMain.handle("my-new-handler", async () => {
  // Your logic here
  return { success: true, data: ... }
})
```

**Step 2:** Expose in `electron/preload.ts`:
```typescript
const electronAPI = {
  // ... existing methods
  myNewMethod: () => ipcRenderer.invoke("my-new-handler")
}
```

**Step 3:** Use in React:
```typescript
const result = await window.electronAPI.myNewMethod()
```

#### 2. Adding New Shortcuts

Edit `electron/shortcuts.ts`:

```typescript
globalShortcut.register("Alt+N", () => {
  // Your shortcut logic
})
```

#### 3. Modifying Page Display

Edit `src/_pages/LocalPages.tsx` to change how pages are rendered.

### Building for Production

Build the application for distribution:

```bash
npm run build
npm run electron:build
```

This creates installers in the `dist/` directory for your platform.

## 📝 Code Structure Details

### IPC Communication Flow

1. **Renderer → Main**: User interacts with UI
2. **Renderer calls**: `window.electronAPI.someMethod()`
3. **Preload forwards**: `ipcRenderer.invoke("handler-name")`
4. **Main handles**: `ipcMain.handle("handler-name", () => {...})`
5. **Main responds**: Returns data to renderer
6. **Renderer updates**: UI updates based on response

### Page Loading Process

1. `LocalPages` component mounts
2. Calls `window.electronAPI.getLocalPages()`
3. Main process reads `pages/` directory
4. For each page folder:
   - Reads `content.txt`
   - Finds and encodes image file
   - Returns page data
5. Component displays pages with navigation

## 🎨 Styling

The app uses Tailwind CSS. Key classes:

- `bg-black`: Dark background
- `text-white`: White text
- `bg-white/10`: 10% opacity white background
- `border-white/10`: 10% opacity white border

Modify styles in components or in `src/index.css` for global styles.

## 🐛 Troubleshooting

### Pages Not Loading

1. Check that `pages/` directory exists in project root
2. Verify each page folder has `content.txt`
3. Check console for errors (Ctrl+Shift+I in dev mode)

### Window Not Showing

1. Try `Alt + B` to toggle visibility
2. Check if window is off-screen, try `Ctrl + Arrow` to move it
3. Restart the application

### Shortcuts Not Working

1. Check if another app is using the same shortcuts
2. Run app as administrator (Windows)
3. Check `electron/shortcuts.ts` for conflicts

## 📚 Useful Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [React Documentation](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/docs)

## 🔐 Security Notes

- The app uses `contextIsolation: true` for security
- Node integration is disabled in renderer
- Only whitelisted IPC methods are exposed
- External URLs open in default browser, not in app

## 📋 Quick Reference

### File Locations

- **Add pages**: `pages/[folder-name]/`
- **Modify UI**: `src/_pages/LocalPages.tsx`
- **Change shortcuts**: `electron/shortcuts.ts`
- **Window settings**: `electron/main.ts`
- **IPC handlers**: `electron/ipcHandlers.ts`

### Common Tasks

**Add a new page:**
1. Create folder in `pages/`
2. Add `content.txt` and image
3. Restart app (it will auto-detect new pages)

**Change window opacity:**
- Use `Ctrl + [` and `Ctrl + ]` at runtime

**Move window:**
- Use `Ctrl + Arrow Keys`

**Hide window:**
- Press `Alt + B`

---

**Need help?** Check the console output for error messages or refer to the code comments in the main files.
