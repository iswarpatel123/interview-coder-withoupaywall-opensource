# Interview Assistant

> 📖 A lightweight, customizable desktop application to display reference pages during coding interviews

## Overview

Interview Assistant is an Electron-based desktop application that helps you keep reference materials handy during coding interviews. It displays your custom pages with text and images in a discreet, always-on-top window that you can quickly show/hide and navigate with keyboard shortcuts.

## Features

- ✨ **Custom Pages**: Create your own reference pages with text and images
- ⌨️ **Keyboard Navigation**: Quick shortcuts to navigate and control the window
- 🪟 **Always on Top**: Window stays above other applications
- 👻 **Quick Hide/Show**: Instantly toggle visibility with Alt+B
- 🎨 **Clean Dark UI**: Minimalist design that's easy on the eyes
- 🔒 **Privacy Focused**: All data stays local on your machine

## Quick Start

### Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Running the App

**Development Mode:**
```bash
npm run dev
```

**Production Mode:**
```bash
# Windows
stealth-run.bat

# Linux/Mac
./stealth-run.sh
```

### Creating Your Pages

1. Navigate to the `pages/` directory
2. Create a new folder for each page (e.g., `algorithms`, `data-structures`)
3. Inside each folder:
   - Add a `content.txt` file with your text content
   - Optionally add an image file (`image.png`, `image.svg`, etc.)

Example structure:
```
pages/
├── algorithms/
│   ├── content.txt
│   └── image.png
├── data-structures/
│   ├── content.txt
│   └── diagram.svg
└── python-cheatsheet/
    └── content.txt
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt + B` | Toggle window visibility |
| `Alt + Left` | Previous page |
| `Alt + Right` | Next page |
| `Ctrl + Arrow Keys` | Move window |
| `Ctrl + [` / `]` | Adjust opacity |
| `Ctrl + -` / `=` / `0` | Zoom control |
| `Ctrl + Q` | Quit application |

## Documentation

For detailed documentation on:
- Creating pages
- Modifying the application
- Adding features
- Troubleshooting

See [agents.md](./agents.md)

## Tech Stack

- **Electron 29**: Desktop framework
- **React 18**: UI library
- **TypeScript**: Type-safe development
- **Vite**: Build tool
- **Tailwind CSS**: Styling

## Project Structure

```
/
├── electron/          # Main process (Node.js)
├── src/              # Renderer process (React)
├── pages/            # Your content pages
└── stealth-run.bat   # Launch script
```

## Building for Production

```bash
npm run build
npm run electron:build
```

This creates platform-specific installers in the `dist/` directory.

## Use Cases

- **Interview Preparation**: Quick reference for algorithms and data structures
- **Coding Tests**: Keep cheat sheets handy
- **Learning**: Display study notes while practicing
- **Reference**: Quick access to syntax and patterns

## Customization

The app is highly customizable:

- Modify UI in `src/_pages/LocalPages.tsx`
- Change shortcuts in `electron/shortcuts.ts`
- Adjust window behavior in `electron/main.ts`
- Add IPC methods in `electron/ipcHandlers.ts`

## Privacy & Security

- All data stored locally
- No external API calls
- No telemetry or tracking
- Content-protected window (won't appear in most screen recordings)

## Contributing

Contributions are welcome! Feel free to:

- Add features
- Improve documentation
- Fix bugs
- Share your page templates

## License

See [LICENSE](./LICENSE) for details.

## Disclaimer

This tool is for educational purposes. Always follow your interview platform's terms of service and code of conduct. Using unauthorized assistance during interviews may violate policies and result in disqualification.

---

**Need Help?** Check the [agents.md](./agents.md) file for detailed documentation or open an issue.
