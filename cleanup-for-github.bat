@echo off
echo ===============================================
echo WARNING: This script removes sensitive files!
echo ===============================================
echo.
echo This script is ONLY for preparing the project
echo for public GitHub sharing. It will remove:
echo - Environment files (.env, etc.)
echo - Build artifacts
echo - Package lock files
echo - Dependencies
echo.
echo Only run this if you intend to publish this
echo project to GitHub and want to remove sensitive data.
echo.
echo Press Ctrl+C to cancel, or any key to continue...
pause >nul

echo.
echo Cleaning up project for GitHub...

echo Removing node_modules directory...
if exist node_modules rmdir /s /q node_modules

echo Removing dist directory...
if exist dist rmdir /s /q dist

echo Removing dist-electron directory...
if exist dist-electron rmdir /s /q dist-electron

echo Removing release directory...
if exist release rmdir /s /q release

echo Removing package-lock.json...
if exist package-lock.json del package-lock.json

echo Removing any .env files (CONTAINS SENSITIVE DATA!)...
if exist .env del .env
if exist .env.local del .env.local
if exist .env.development del .env.development
if exist .env.production del .env.production

echo.
echo ===============================================
echo CLEANUP COMPLETE!
echo ===============================================
echo.
echo The project is now ready for GitHub.
echo IMPORTANT: Your .env file has been DELETED!
echo Copy .env.example to .env and add your API keys.
echo.
echo Run 'npm install' after cloning to install dependencies.
pause
