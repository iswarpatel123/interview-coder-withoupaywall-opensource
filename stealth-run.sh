#!/bin/bash
echo "=== Interview Assistant - Reference Pages Viewer ==="
echo
echo "IMPORTANT: This app displays your custom reference pages!"
echo "Use the keyboard shortcuts to control it:"
echo
echo "- Toggle Visibility: Alt+B"
echo "- Navigate Pages: Alt+Left / Alt+Right"
echo "- Move Window: Ctrl+Arrows (Left/Right/Up/Down)"
echo "- Adjust Opacity: Ctrl+[ (decrease) / Ctrl+] (increase)"
echo "- Zoom: Ctrl+- (out) / Ctrl+= (in) / Ctrl+0 (reset)"
echo "- Quit App: Ctrl+Q"
echo
echo "Add your pages in the 'pages/' directory."
echo "Each page needs a folder with content.txt and optionally an image."
echo

# Navigate to script directory
cd "$(dirname "$0")"

echo "=== Step 1: Creating required directories... ==="
mkdir -p ~/Library/Application\ Support/interview-coder-v1/temp
mkdir -p ~/Library/Application\ Support/interview-coder-v1/cache
mkdir -p ~/Library/Application\ Support/interview-coder-v1/screenshots
mkdir -p ~/Library/Application\ Support/interview-coder-v1/extra_screenshots

echo "=== Step 2: Cleaning previous builds... ==="
echo "Removing old build files to ensure a fresh start..."
rm -rf dist dist-electron
rm -f .env

echo "=== Step 3: Building application... ==="
echo "This may take a moment..."
npm run build

echo "=== Step 4: Launching application... ==="
echo "Remember: Press Alt+B to toggle visibility, Alt+Left/Right to navigate pages!"
echo
export NODE_ENV=production
npx electron ./dist-electron/main.js &

echo "App is now running! Press Alt+B to toggle visibility."
echo
echo "If you encounter any issues:"
echo "1. Make sure you've installed dependencies with 'npm install'"
echo "2. Make sure this script has execute permissions (chmod +x stealth-run.sh)"
echo "3. Press Alt+B to toggle visibility"
echo "4. Check Activity Monitor to verify the app is running"
echo "5. Add pages in the 'pages/' directory if you see no content"
