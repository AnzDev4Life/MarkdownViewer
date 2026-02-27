const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const MarkdownIt = require('markdown-it');
const hljs = require('highlight.js');
const prettier = require('prettier');
const { minify: terserMinify } = require('terser');
const CleanCSS = require('clean-css');
const { minify: htmlMinify } = require('html-minifier-terser');
const sanitizeHtml = require('sanitize-html');

// keep track of a file path that should be opened when a window is ready
let pendingOpenPath = '';
let mainWindow = null;

// ensure only one instance is running so we can handle multiple opens on Windows
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (event, argv) => {
    if (process.platform === 'win32') {
      // executable may be the first arg, look for .md/.markdown files
      const fileArg = argv.find(arg => arg.match(/\.(md|markdown)$/i));
      if (fileArg) {
        pendingOpenPath = fileArg;
        if (mainWindow) {
          openPathInWindow(fileArg);
        }
      }
    }
  });
}

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight: function (str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return '<pre class="hljs"><code>' + hljs.highlight(str, {language: lang}).value + '</code></pre>';
      } catch (__) {}
    }
    return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>';
  }
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'src', 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile(path.join('src', 'renderer', 'index.html'));
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // if we already had a file request queued, send it along
  if (pendingOpenPath) {
    openPathInWindow(pendingOpenPath);
    pendingOpenPath = '';
  }
}

app.whenReady().then(() => {
  createWindow();

  // if the app was launched with a file argument
  if (process.platform === 'win32') {
    const args = process.argv.slice(1);
    const fileArg = args.find(arg => arg.match(/\.(md|markdown)$/i));
    if (fileArg) pendingOpenPath = fileArg;
  }
});

// macOS: open-file event fired when user double-clicks an associated document
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  pendingOpenPath = filePath;
  if (mainWindow) openPathInWindow(filePath);
});

ipcMain.handle('dialog:openFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Markdown and text', extensions: ['md','markdown','txt','json','js','ts','html','css'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  if (canceled || filePaths.length === 0) return { canceled: true };
  const content = await fs.readFile(filePaths[0], 'utf8');
  return { canceled: false, filePath: filePaths[0], content };
});

// let renderer ask for any initial file that was queued before the window existed
ipcMain.handle('get-initial-file', async () => {
  if (pendingOpenPath) {
    try {
      const content = await fs.readFile(pendingOpenPath, 'utf8');
      const result = { canceled: false, filePath: pendingOpenPath, content };
      pendingOpenPath = '';
      return result;
    } catch (e) {
      return { canceled: true };
    }
  }
  return { canceled: true };
});

ipcMain.handle('render:markdown', (event, text, filePath) => {
  try {
    const ext = getExt(filePath) || detectTypeFromContent(text) || '';
    if (ext === 'html') {
      // sanitize HTML before returning
      const sanitized = sanitizeHtml(String(text || ''), {
        allowedSchemes: ['http', 'https', 'mailto', 'data'],
        allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img','style','link']),
        allowedAttributes: {
          '*': ['class', 'id', 'style', 'src', 'href', 'alt', 'title', 'width', 'height']
        }
      });
      return { type: 'html', content: sanitized };
    }
    if (ext === 'md' || ext === 'markdown') {
      return { type: 'markdown', content: md.render(String(text || '')) };
    }
    // default: plain text
    return { type: 'plain', content: String(text || '') };
  } catch (e) {
    console.error('Markdown render error', e);
    return { type: 'plain', content: String(text || '') };
  }
});

// Helpers for formatting/minifying
function getExt(filePath) {
  try {
    if (!filePath || typeof filePath !== 'string') return '';
    const ext = path.extname(filePath || '').toLowerCase();
    return ext ? ext.replace('.', '') : '';
  } catch (e) { return ''; }
}

function detectTypeFromContent(text) {
  if (!text || typeof text !== 'string') return '';
  try { JSON.parse(text); return 'json'; } catch (e) {}
  if (/<[a-z!][\s\S]*>/i.test(text)) return 'html';
  // simple heuristic
  if (/^\s*[{\[]/.test(text)) return 'json';
  return 'js';
}

ipcMain.handle('format:beautify', async (event, text, filePath) => {
  const ext = getExt(filePath) || detectTypeFromContent(text) || 'json';
  let parser = 'json';
  if (ext === 'json') parser = 'json';
  else if (ext === 'html') parser = 'html';
  else if (ext === 'css') parser = 'css';
  else if (ext === 'ts') parser = 'typescript';
  else parser = 'babel';
  try {
    const opts = { parser, tabWidth: 2, useTabs: false };
    return prettier.format(String(text || ''), opts);
  } catch (e) {
    console.error('Prettier format error', e);
    return String(text || '');
  }
});

ipcMain.handle('format:minify', async (event, text, filePath) => {
  const ext = getExt(filePath) || detectTypeFromContent(text) || '';
  try {
    if (ext === 'json') {
      return JSON.stringify(JSON.parse(String(text || '')));
    }
    if (ext === 'js' || ext === 'ts') {
      const result = await terserMinify(String(text || ''));
      return (result && result.code) ? result.code : String(text || '');
    }
    if (ext === 'css') {
      const out = new CleanCSS({}).minify(String(text || ''));
      return out && out.styles ? out.styles : String(text || '');
    }
    if (ext === 'html') {
      return await htmlMinify(String(text || ''), { collapseWhitespace: true, removeComments: true, minifyCSS: true, minifyJS: true });
    }
    // fallback
    return String(text || '').replace(/\s+/g, ' ').trim();
  } catch (e) {
    console.error('Minify error', e);
    return String(text || '');
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// helper used internally when a file path needs to be dispatched to renderer
async function openPathInWindow(filePath) {
  if (!mainWindow) return;
  try {
    const content = await fs.readFile(filePath, 'utf8');
    mainWindow.webContents.send('auto-open', { canceled: false, filePath, content });
  } catch (e) {
    mainWindow.webContents.send('auto-open', { canceled: true });
  }
}
