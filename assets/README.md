Assets placeholder directory for MarkdownViewer

This folder contains placeholder SVG assets (icon and a sample screenshot).

Recommended next steps to create store-ready assets:

1. Generate PNG and ICO icons at required sizes (examples):
   - 44x44, 50x50, 150x150, 300x300, 1024x1024 (store promotional images may require larger sizes).
   - Use ImageMagick to convert SVG to PNG: convert icon.svg -resize 1024x1024 icon-1024.png
   - Create ICO from PNG: convert icon-256.png icon.ico

2. Screenshots:
   - Create PNG screenshots at 1240x768 (landscape) and other sizes required by the Microsoft Store.
   - Example (ImageMagick): convert screenshot-1.svg -resize 1240x768 screenshot-1.png

3. Update package.json build.icon to point to your .ico file (e.g., "build/icon.ico").

4. For MSIX signing, obtain a code-signing certificate (PFX) and your publisher ID (CN=...). Update the electron-builder configuration with the certificate and publisher information before building for the Microsoft Store.

These files are placeholders; replace them with polished artwork before submitting to the Microsoft Store.
