@echo off
echo === Interview Assistant - Reference Pages Viewer ===
echo.
echo IMPORTANT: This app displays your custom reference pages!
echo Use the keyboard shortcuts to control it:
echo.
echo - Toggle Visibility: Alt+B
echo - Navigate Pages: Alt+Left / Alt+Right
echo - Move Window: Ctrl+Arrows (Left/Right/Up/Down)
echo - Adjust Opacity: Ctrl+[ (decrease) / Ctrl+] (increase)
echo - Zoom: Ctrl+- (out) / Ctrl+= (in) / Ctrl+0 (reset)
echo - Quit App: Ctrl+Q
echo.
echo Add your pages in the 'pages/' directory.
echo Each page needs a folder with content.txt and optionally an image.
echo.

cd /D "%~dp0"

echo === Step 1: Creating required directories... ===
mkdir "%APPDATA%\interview-coder-v1\temp" 2>nul
mkdir "%APPDATA%\interview-coder-v1\cache" 2>nul
mkdir "%APPDATA%\interview-coder-v1\screenshots" 2>nul
mkdir "%APPDATA%\interview-coder-v1\extra_screenshots" 2>nul

echo === Step 2: Cleaning previous builds... ===
echo Removing old build files to ensure a fresh start...
rmdir /s /q dist dist-electron 2>nul
del /q .env 2>nul

echo === Step 3: Building application... ===
echo This may take a moment...
call npm run build

echo === Step 4: Launching application... ===
echo Remember: Press Alt+B to toggle visibility, Alt+Left/Right to navigate pages!
echo.
set NODE_ENV=production
start /B cmd /c "npx electron ./dist-electron/main.js"

echo App is now running! Press Alt+B to toggle visibility.
echo.
echo If you encounter any issues:
echo 1. Make sure you've installed dependencies with 'npm install'
echo 2. Press Alt+B to toggle visibility
echo 3. Check Task Manager to verify the app is running
echo 4. Add pages in the 'pages/' directory if you see no content