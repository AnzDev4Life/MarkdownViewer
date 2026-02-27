# MarkdownViewer

A simple Electron-based Markdown editor and viewer.  Supports live preview, syntax highlighting, and basic formatting tools.  
The app can now be installed on Windows and will register itself as the default handler for `.md` and `.markdown` files, allowing users to open documents from the Explorer context menu or by double-clicking.

## Features

- Open Markdown (and plain text) files with a file picker or drag/drop
- Live HTML preview with syntax highlighting (highlight.js)
- Toggle controls for showing/hiding the source editor and preview panels
- When loading Markdown/HTML files the editor is initially hidden and the preview is shown full-width
- Beautify/minify support for a variety of file types using Prettier, Terser, CleanCSS
- Recent file list stored in `localStorage`
- Windows installer with file association for `.md`/`.markdown`
- Single-instance handling and automatic opening when a markdown file is launched

## Installation

1. Download a release from the [Releases](https://github.com/annguyen209/MarkdownViewer/releases) page.
2. Run the installer (`MarkdownViewer Setup x.y.z.exe`).
3. After installation you can right-click a `.md` or `.markdown` file and choose **Open with > MarkdownViewer**.  Use "Always use this app" to set it as the default.

> **Note:** running `npm start` in the source does not register associations; only the installed copy does.

## Development

```bash
# clone repository if you haven't already
git clone https://github.com/annguyen209/MarkdownViewer.git
cd MarkdownViewer

# install dependencies
npm install

# run in development mode
npm start
```

### Building

```bash
npm run dist     # produce installer (NSIS target)
```

The packaging step will produce `dist/MarkdownViewer Setup <version>.exe`.  After installing that executable the file associations will be registered automatically.

## File Association

The Electron builder configuration (`package.json -> build.fileAssociations`) defines
`.md` and `.markdown` as handled extensions.  During installation the app is added
to the Windows registry so that Explorer shows it in the **Open with...** menu.

The main process uses a single-instance lock to capture file paths passed on the
command line or received via the `open-file` event (macOS).  The renderer then
loads and renders the file automatically.

## License

ISC

---

For more details and contribution guidelines, see the source files in `src/`.
### Panel Visibility

Two new buttons in the header allow you to toggle the visibility of the source (editor) and the rendered preview. By default the source is hidden when a Markdown or HTML file is opened, so you immediately see the rendered content; use **Toggle Source** to bring the editor back. Hiding the preview will no longer re‑open it automatically when you type; click **Toggle Preview** again to bring it back. Likewise **Toggle Source** hides the editor and expands the preview to fill the window.

