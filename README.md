# MarkdownViewer

A desktop Markdown editor and viewer built with Electron. Live preview, 8 built-in themes, syntax highlighting, and one-click export to PDF, DOCX, and HTML — no external tools required.

## Features

### Editor & Preview

- **Live preview** — preview updates as you type (150 ms debounce)
- **Split view** — editor and preview side-by-side with synchronised scrolling
- **Full Markdown rendering** — headings (h1–h6), tables, task lists (`- [ ]` / `- [x]`), strikethrough, blockquotes, fenced code blocks, horizontal rules, links, images
- **Syntax highlighting** — highlight.js with a code theme matched to the active document theme
- **Toggle panels** — show/hide editor or preview independently; preview goes full-width when editor is hidden
- **Open files** — file picker, drag-and-drop, or double-click a `.md`/`.markdown` file in Explorer
- **Recent files** — last 10 opened files stored in `localStorage`
- **Search** — find text in the editor with wrap-around
- **Format / Minify** — Prettier, Terser, and CleanCSS for JS, TS, JSON, CSS, and HTML files
- **Status bar** — live word count, line count, and filename

### Themes

Eight document themes selectable from the toolbar, each paired with a matching highlight.js syntax theme:

| Theme | Style | Code highlighting |
|---|---|---|
| Light | Clean white | github |
| **GitHub** *(default)* | GitHub README style | github |
| Solarized Light | Warm cream | base16/solarized-light |
| Dark | Slate dark | github-dark |
| GitHub Dark | GitHub dark mode | github-dark |
| Solarized Dark | Deep teal | base16/solarized-dark |
| Dracula | Purple accent | base16/dracula |
| Nord | Arctic blue | base16/nord |

Theme and font size are persisted across sessions via `localStorage`.

### Export

Click **Export ▾** in the toolbar to save the current document:

| Format | How it works |
|---|---|
| **PDF** | Renders the preview in a hidden Electron window and exports via `printToPDF` — no external tools needed, full multi-page output with proper table layout |
| **Word (.docx)** | Converts the markdown token stream to a native Word document using the `docx` package — headings, bold/italic/strikethrough, bullet and numbered lists, tables, code blocks, blockquotes, horizontal rules |
| **HTML** | Saves a standalone `.html` file with all CSS embedded — opens correctly in any browser with the same look as the app |

## Screenshots

> *Switch themes from the toolbar dropdown. The editor, preview, toolbar, and status bar all repaint instantly.*

## Installation

Download the latest installer from the [Releases](https://github.com/AnzDev4Life/MarkdownViewer/releases) page and run `MarkdownViewer Setup x.y.z.exe`. After installation, `.md` and `.markdown` files will open in MarkdownViewer from the Explorer context menu.

## Development

```bash
git clone https://github.com/AnzDev4Life/MarkdownViewer.git
cd MarkdownViewer
npm install
npm start
```

### Build installer

```bash
npm run dist
```

Produces `dist/MarkdownViewer Setup <version>.exe` with Windows file associations registered automatically.

## Tech Stack

| | |
|---|---|
| Shell | Electron 40 |
| Markdown rendering | markdown-it 14 |
| Syntax highlighting | highlight.js 11 |
| DOCX generation | docx 9 |
| Code formatting | Prettier, Terser, CleanCSS |
| Theming | CSS custom properties (no framework) |

## Project Structure

```
main.js               — Electron main process (IPC, menus, file handling)
src/
  exporter.js         — Export functions: PDF, DOCX, HTML
  preload.js          — contextBridge API surface
  renderer/
    index.html        — App shell and toolbar
    renderer.js       — UI logic, theme switching, live preview
    styles.css        — All themes and markdown styles (CSS variables)
```

## License

ISC
