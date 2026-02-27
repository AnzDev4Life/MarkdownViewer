const editor = document.getElementById("editor");
const preview = document.getElementById("preview");
const openBtn = document.getElementById("openBtn");
const beautifyBtn = document.getElementById("beautifyBtn");
const minifyBtn = document.getElementById("minifyBtn");
const toggleSourceBtn = document.getElementById("toggleSourceBtn");
const togglePreviewBtn = document.getElementById("togglePreviewBtn");
const recentFilesSelect = document.getElementById("recentFiles");
const searchBox = document.getElementById("searchBox");
const findNextBtn = document.getElementById("findNextBtn");
const themeToggle = document.getElementById("themeToggle");
const fontSize = document.getElementById("fontSize");

let currentFilePath = '';

function isPreviewable(filePath) {
  if (!filePath || typeof filePath !== 'string') return false;
  const match = filePath.match(/\.([^.]+)$/);
  if (!match) return false;
  const ext = match[1].toLowerCase();
  return ['md','markdown','html','htm'].includes(ext);
}

function loadFile(path, content) {
  currentFilePath = path || '';
  editor.value = content || '';
  render();
  if (isPreviewable(path)) {
    setEditorVisible(false);
    setPreviewVisible(true);
    autoShowPreview = true;
  } else {
    setEditorVisible(true);
  }
  if (path) saveToRecent(path, content);
}

function setPreviewVisible(visible) {
  if (visible) {
    preview.classList.remove('hidden');
    editor.classList.remove('fullwidth');
  } else {
    preview.classList.add('hidden');
    editor.classList.add('fullwidth');
  }
}

function setEditorVisible(visible) {
  if (visible) {
    editor.classList.remove('hidden');
    preview.classList.remove('fullwidth');
  } else {
    editor.classList.add('hidden');
    preview.classList.add('fullwidth');
  }
}

let autoShowPreview = true; // when false, render() will not force preview visible

async function render() {
  try {
    if (window.electronAPI && typeof window.electronAPI.renderMarkdown === 'function') {
      const result = window.electronAPI.renderMarkdown(editor.value, currentFilePath);
      const res = (result && typeof result.then === 'function') ? await result : result;
      if (res && typeof res === 'object' && res.type) {
        if (res.type === 'html' || res.type === 'markdown') {
          if (autoShowPreview) setPreviewVisible(true);
          preview.innerHTML = res.content;
        } else {
          if (autoShowPreview) setPreviewVisible(false);
          preview.textContent = res.content;
        }
      } else if (typeof res === 'string') {
        if (autoShowPreview) setPreviewVisible(true);
        preview.innerHTML = res;
      } else {
        if (autoShowPreview) setPreviewVisible(false);
        preview.textContent = String(res || editor.value);
      }
    } else {
      // No electronAPI available: default to hiding preview unless content clearly looks like HTML/Markdown
      const text = editor.value || '';
      const looksLikeMarkdown = /^\s*(#|[-*]|>|```)/.test(text);
      const looksLikeHtml = /<[a-z!][\s\S]*>/i.test(text);
      if (looksLikeMarkdown || looksLikeHtml) {
        if (autoShowPreview) setPreviewVisible(true);
        preview.textContent = text;
      } else {
        if (autoShowPreview) setPreviewVisible(false);
        preview.textContent = text;
      }
    }
  } catch (e) {
    console.error('Render error', e);
    if (autoShowPreview) setPreviewVisible(false);
    preview.textContent = editor.value;
  }
}

function loadRecentFiles() {
  let list = [];
  try {
    list = JSON.parse(localStorage.getItem('recentFiles') || '[]');
  } catch(e) { list = []; }
  recentFilesSelect.innerHTML = '<option value="">Recent files</option>';
  list.forEach((item, idx) => {
    const opt = document.createElement('option');
    opt.value = idx;
    opt.textContent = item.name || item.path || `File ${idx+1}`;
    recentFilesSelect.appendChild(opt);
  });
}

function saveToRecent(filePath, content) {
  try {
    const name = filePath ? (filePath.split(/[\\/]/).pop()) : 'Untitled';
    let list = JSON.parse(localStorage.getItem('recentFiles') || '[]');
    list = list.filter(f => f.path !== filePath);
    list.unshift({ path: filePath, name, content });
    if (list.length > 10) list = list.slice(0,10);
    localStorage.setItem('recentFiles', JSON.stringify(list));
    loadRecentFiles();
  } catch(e) {}
}

openBtn.addEventListener("click", async () => {
  if (window.electronAPI && typeof window.electronAPI.openFile === 'function') {
    const result = await window.electronAPI.openFile();
    if (!result || result.canceled) return;
    loadFile(result.filePath || '', result.content);
    return;
  }
  // Fallback for non-Electron contexts: use file input
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.md,.markdown,.txt,.json,.js,.ts,.html,.css,*/*';
  input.onchange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      loadFile(file.name || '', reader.result || '');
    };
    reader.readAsText(file);
  };
  input.click();
});

recentFilesSelect.addEventListener("change", () => {
  const idx = recentFilesSelect.value;
  if (idx === "" ) return;
  const list = JSON.parse(localStorage.getItem('recentFiles') || '[]');
  const item = list[Number(idx)];
  if (item) {
    loadFile(item.path || '', item.content || '');
  }
});

document.addEventListener("dragover", (e) => e.preventDefault());
document.addEventListener("drop", async (e) => {
  e.preventDefault();
  if (!e.dataTransfer || e.dataTransfer.files.length === 0) return;
  const file = e.dataTransfer.files[0];
  if (!file) return;
  // Try to read via FileReader (works in both Electron renderer and browsers)
  try {
    const reader = new FileReader();
    reader.onload = () => {
      loadFile(file.path || file.name || '', reader.result || '');
    };
    reader.readAsText(file);
  } catch (err) {
    // As a last resort, if electronAPI exists, ask main to read the file path
    if (window.electronAPI && typeof window.electronAPI.openFile === 'function' && file.path) {
      const result = await window.electronAPI.openFile();
      if (result && !result.canceled) {
        currentFilePath = result.filePath || '';
        editor.value = result.content;
        render();
        if (result.filePath) saveToRecent(result.filePath, result.content);
      }
    }
  }
});

// Beautify/Minify buttons
if (beautifyBtn) {
  beautifyBtn.addEventListener('click', async () => {
    try {
      const text = editor.value;
      const formatted = (window.electronAPI && typeof window.electronAPI.beautify === 'function') ? await window.electronAPI.beautify(text, currentFilePath) : text;
      editor.value = formatted || text;
      render();
    } catch (e) {
      console.error('Beautify error', e);
      alert('Beautify failed: ' + (e && e.message || e));
    }
  });
}

if (minifyBtn) {
  minifyBtn.addEventListener('click', async () => {
    try {
      const text = editor.value;
      const minified = (window.electronAPI && typeof window.electronAPI.minify === 'function') ? await window.electronAPI.minify(text, currentFilePath) : text;
      editor.value = minified || text;
      render();
    } catch (e) {
      console.error('Minify error', e);
      alert('Minify failed: ' + (e && e.message || e));
    }
  });
}

themeToggle.addEventListener("change", () => {
  document.documentElement.setAttribute("data-theme", themeToggle.value);
});
fontSize.addEventListener("input", () => {
  editor.style.fontSize = fontSize.value + "px";
  preview.style.fontSize = fontSize.value + "px";
});

// toggle buttons
if (togglePreviewBtn) {
  togglePreviewBtn.addEventListener('click', () => {
    const currentlyHidden = preview.classList.contains('hidden');
    setPreviewVisible(currentlyHidden);
    autoShowPreview = currentlyHidden; // if we just showed it, allow future auto shows; if we hid it manually, stop auto re-opening
  });
}

if (toggleSourceBtn) {
  toggleSourceBtn.addEventListener('click', () => {
    const currentlyHidden = editor.classList.contains('hidden');
    setEditorVisible(currentlyHidden);
  });
}

// handle file sent from main process (startup/auto-open)
async function applyFileResult(result) {
  if (!result || result.canceled) return;
  loadFile(result.filePath || '', result.content || '');
}

// ask main for initial file when DOM is ready
window.addEventListener('DOMContentLoaded', async () => {
  if (window.electronAPI && typeof window.electronAPI.getInitialFile === 'function') {
    const res = await window.electronAPI.getInitialFile();
    await applyFileResult(res);
  }
});

if (window.electronAPI && typeof window.electronAPI.onAutoOpen === 'function') {
  window.electronAPI.onAutoOpen(async (res) => {
    await applyFileResult(res);
  });
}

// search
let lastSearchTerm = '';
let lastSearchIndex = 0;

findNextBtn.addEventListener("click", () => {
  const q = searchBox.value;
  if (!q) return;
  const text = editor.value;
  if (q !== lastSearchTerm) {
    lastSearchTerm = q;
    lastSearchIndex = 0;
  }
  const found = text.indexOf(q, lastSearchIndex);
  if (found === -1) {
    lastSearchIndex = 0;
    const foundWrap = text.indexOf(q, 0);
    if (foundWrap === -1) return;
    editor.focus();
    editor.setSelectionRange(foundWrap, foundWrap + q.length);
    editor.scrollTop = editor.scrollHeight * (foundWrap / text.length);
    lastSearchIndex = foundWrap + q.length;
  } else {
    editor.focus();
    editor.setSelectionRange(found, found + q.length);
    editor.scrollTop = editor.scrollHeight * (found / text.length);
    lastSearchIndex = found + q.length;
  }
});

// initial load
loadRecentFiles();
render();
