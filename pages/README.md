# Pages Directory

This directory contains your interview reference pages. Each page is a separate folder with content and optional images.

## Structure

Each page folder should contain:
- `content.txt` - Your text content (required)
- `image.[png|jpg|svg|gif]` - An image (optional)

## Example

```
pages/
├── page1/
│   ├── content.txt
│   └── image.svg
├── page2/
│   ├── content.txt
│   └── image.svg
└── my-custom-page/
    ├── content.txt
    └── diagram.png
```

## Creating a New Page

1. Create a new folder with any name (e.g., `python-cheatsheet`)
2. Add a `content.txt` file with your text content
3. Optionally add an image file (PNG, JPG, SVG, or GIF)
4. Restart the application to see your new page

## Tips

- Folder names will be displayed as page titles
- Pages are sorted alphabetically by folder name
- Use descriptive folder names like `data-structures` or `algorithms`
- Keep images reasonably sized (400-800px wide recommended)
- Text content preserves line breaks and spacing

## Navigation

Once the app is running:
- Press `Alt + Left/Right` to navigate between pages
- Press `Alt + B` to hide/show the window
- Press `Ctrl + Arrow Keys` to move the window
