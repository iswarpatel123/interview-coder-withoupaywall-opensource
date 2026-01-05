#!/bin/bash

echo "==============================================="
echo "WARNING: This script removes sensitive files!"
echo "==============================================="
echo
echo "This script is ONLY for preparing the project"
echo "for public GitHub sharing. It will remove:"
echo "- Environment files (.env, etc.)"
echo "- Build artifacts"
echo "- Package lock files"
echo "- Dependencies"
echo
echo "Only run this if you intend to publish this"
echo "project to GitHub and want to remove sensitive data."
echo
read -p "Press Enter to continue, or Ctrl+C to cancel..."

echo
echo "Cleaning up project for GitHub..."

echo "Removing node_modules directory..."
rm -rf node_modules

echo "Removing dist directory..."
rm -rf dist

echo "Removing dist-electron directory..."
rm -rf dist-electron

echo "Removing release directory..."
rm -rf release

echo "Removing package-lock.json..."
rm -f package-lock.json

echo "Removing any .env files (CONTAINS SENSITIVE DATA!)..."
rm -f .env .env.local .env.development .env.production

echo
echo "==============================================="
echo "CLEANUP COMPLETE!"
echo "==============================================="
echo
echo "The project is now ready for GitHub."
echo "IMPORTANT: Your .env file has been DELETED!"
echo "Copy .env.example to .env and add your API keys."
echo
echo "Run 'npm install' after cloning to install dependencies."
echo "Press Enter to continue..."
read
