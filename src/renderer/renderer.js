const editor = document.getElementById('editor');
const preview = document.getElementById('preview');
const openBtn = document.getElementById('openBtn');
const beautifyBtn = document.getElementById('beautifyBtn');
const minifyBtn = document.getElementById('minifyBtn');
const toggleSourceBtn = document.getElementById('toggleSourceBtn');
const togglePreviewBtn = document.getElementById('togglePreviewBtn');
const recentFilesSelect = document.getElementById('recentFiles');
const searchBox = document.getElementById('searchBox');
const findNextBtn = document.getElementById('findNextBtn');
const themeToggle = document.getElementById('themeToggle');
const fontSize = document.getElementById('fontSize');
const exportBtn = document.getElementById('exportBtn');
const exportMenu = document.getElementById('exportMenu');
const overflowBtn = document.getElementById('overflowBtn');
const overflowMenu = document.getElementById('overflowMenu');
const ovfBeautifyBtn = document.getElementById('ovfBeautifyBtn');
const ovfMinifyBtn = document.getElementById('ovfMinifyBtn');
const ovfSearchBox = document.getElementById('ovfSearchBox');
const ovfFindBtn = document.getElementById('ovfFindBtn');
const ovfThemeToggle = document.getElementById('ovfThemeToggle');
const ovfFontSize = document.getElementById('ovfFontSize');
const ovfRecentFiles = document.getElementById('ovfRecentFiles');
const ovfRecentSection = document.getElementById('ovfRecentSection');
const ovfActionsSection = document.getElementById('ovfActionsSection');
const ovfSearchSection = document.getElementById('ovfSearchSection');
const ovfSettingsSection = document.getElementById('ovfSettingsSection');

const HL_THEME_MAP = {
  'light':           '../../node_modules/highlight.js/styles/github.css',
  'dark':            '../../node_modules/highlight.js/styles/github-dark.css',
  'github':          '../../node_modules/highlight.js/styles/github.css',
  'github-dark':     '../../node_modules/highlight.js/styles/github-dark.css',
  'solarized-light': '../../node_modules/highlight.js/styles/base16/solarized-light.css',
  'solarized-dark':  '../../node_modules/highlight.js/styles/base16/solarized-dark.css',
  'dracula':         '../../node_modules/highlight.js/styles/base16/dracula.css',
  'nord':            '../../node_modules/highlight.js/styles/base16/nord.css',
};

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const hlLink = document.getElementById('hlTheme');
  if (hlLink) hlLink.href = HL_THEME_MAP[theme] ?? HL_THEME_MAP['github'];
  localStorage.setItem('theme', theme);
  themeToggle.value = theme;
  if (ovfThemeToggle) ovfThemeToggle.value = theme;
}

let currentFilePath = '';

function updateStatus() {
  const text = editor.value;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const lines = text.split('\n').length;
  const name = currentFilePath ? currentFilePath.split(/[\\/]/).pop() : 'Untitled';
  const statusLeft = document.getElementById('statusLeft');
  if (statusLeft) statusLeft.textContent = `${name}  ·  ${words} words  ·  ${lines} lines  ·  ${window.innerWidth}×${window.innerHeight}`;
}

function isPreviewable(filePath) {
  if (!filePath || typeof filePath !== 'string') return false;
  const match = filePath.match(/\.([^.]+)$/);
  if (!match) return false;
  return ['md', 'markdown', 'html', 'htm'].includes(match[1].toLowerCase());
}

const FORMATTABLE_EXTS = new Set(['js', 'ts', 'json', 'html', 'htm', 'css']);

function updateFormatButtons() {
  const match = currentFilePath.match(/\.([^.]+)$/);
  const ext = match ? match[1].toLowerCase() : '';
  const enabled = FORMATTABLE_EXTS.has(ext);
  if (beautifyBtn) beautifyBtn.disabled = !enabled;
  if (minifyBtn) minifyBtn.disabled = !enabled;
  if (ovfBeautifyBtn) ovfBeautifyBtn.disabled = !enabled;
  if (ovfMinifyBtn) ovfMinifyBtn.disabled = !enabled;
}

function loadFile(path, content) {
  currentFilePath = path || '';
  editor.value = content || '';
  render();
  updateStatus();
  updateFormatButtons();
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
  if (togglePreviewBtn) togglePreviewBtn.classList.toggle('active', visible);
}

function setEditorVisible(visible) {
  if (visible) {
    editor.classList.remove('hidden');
    preview.classList.remove('fullwidth');
  } else {
    editor.classList.add('hidden');
    preview.classList.add('fullwidth');
  }
  if (toggleSourceBtn) toggleSourceBtn.classList.toggle('active', visible);
}

let autoShowPreview = true;

async function render() {
  clearFindMarks();
  findTerm = '';
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
  try { list = JSON.parse(localStorage.getItem('recentFiles') || '[]'); } catch (e) { list = []; }
  recentFilesSelect.innerHTML = '<option value="">Recent files</option>';
  if (ovfRecentFiles) {
    while (ovfRecentFiles.firstChild) ovfRecentFiles.removeChild(ovfRecentFiles.firstChild);
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Recent files';
    ovfRecentFiles.appendChild(placeholder);
  }
  list.forEach((item, idx) => {
    const label = item.name || item.path || `File ${idx + 1}`;
    const opt = document.createElement('option');
    opt.value = idx;
    opt.textContent = label;
    recentFilesSelect.appendChild(opt);
    if (ovfRecentFiles) {
      const opt2 = document.createElement('option');
      opt2.value = idx;
      opt2.textContent = label;
      ovfRecentFiles.appendChild(opt2);
    }
  });
}

function saveToRecent(filePath, content) {
  try {
    const name = filePath ? filePath.split(/[\\/]/).pop() : 'Untitled';
    let list = JSON.parse(localStorage.getItem('recentFiles') || '[]');
    list = list.filter(f => f.path !== filePath);
    list.unshift({ path: filePath, name, content });
    if (list.length > 10) list = list.slice(0, 10);
    localStorage.setItem('recentFiles', JSON.stringify(list));
    loadRecentFiles();
  } catch (e) {}
}

openBtn.addEventListener('click', async () => {
  if (window.electronAPI && typeof window.electronAPI.openFile === 'function') {
    const result = await window.electronAPI.openFile();
    if (!result || result.canceled) return;
    loadFile(result.filePath || '', result.content);
    return;
  }
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.md,.markdown,.txt,.json,.js,.ts,.html,.css,*/*';
  input.onchange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => loadFile(file.name || '', reader.result || '');
    reader.readAsText(file);
  };
  input.click();
});

recentFilesSelect.addEventListener('change', () => {
  const idx = recentFilesSelect.value;
  if (idx === '') return;
  const list = JSON.parse(localStorage.getItem('recentFiles') || '[]');
  const item = list[Number(idx)];
  if (item) loadFile(item.path || '', item.content || '');
});

document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', async (e) => {
  e.preventDefault();
  if (!e.dataTransfer || e.dataTransfer.files.length === 0) return;
  const file = e.dataTransfer.files[0];
  if (!file) return;
  try {
    const reader = new FileReader();
    reader.onload = () => loadFile(file.path || file.name || '', reader.result || '');
    reader.readAsText(file);
  } catch (err) {
    if (window.electronAPI && typeof window.electronAPI.openFile === 'function' && file.path) {
      const result = await window.electronAPI.openFile();
      if (result && !result.canceled) {
        currentFilePath = result.filePath || '';
        editor.value = result.content;
        render();
        updateStatus();
        if (result.filePath) saveToRecent(result.filePath, result.content);
      }
    }
  }
});

if (beautifyBtn) {
  beautifyBtn.addEventListener('click', async () => {
    try {
      const text = editor.value;
      const formatted = (window.electronAPI && typeof window.electronAPI.beautify === 'function')
        ? await window.electronAPI.beautify(text, currentFilePath) : text;
      editor.value = formatted || text;
      render();
    } catch (e) {
      console.error('Beautify error', e);
      alert('Format failed: ' + (e && e.message || e));
    }
  });
}

if (minifyBtn) {
  minifyBtn.addEventListener('click', async () => {
    try {
      const text = editor.value;
      const minified = (window.electronAPI && typeof window.electronAPI.minify === 'function')
        ? await window.electronAPI.minify(text, currentFilePath) : text;
      editor.value = minified || text;
      render();
    } catch (e) {
      console.error('Minify error', e);
      alert('Minify failed: ' + (e && e.message || e));
    }
  });
}

themeToggle.addEventListener('change', () => applyTheme(themeToggle.value));

fontSize.addEventListener('input', () => {
  const size = fontSize.value + 'px';
  editor.style.fontSize = size;
  preview.style.fontSize = size;
  localStorage.setItem('fontSize', fontSize.value);
  if (ovfFontSize) ovfFontSize.value = fontSize.value;
});

if (togglePreviewBtn) {
  togglePreviewBtn.addEventListener('click', () => {
    const currentlyHidden = preview.classList.contains('hidden');
    setPreviewVisible(currentlyHidden);
    autoShowPreview = currentlyHidden;
  });
}

if (toggleSourceBtn) {
  toggleSourceBtn.addEventListener('click', () => {
    const currentlyHidden = editor.classList.contains('hidden');
    setEditorVisible(currentlyHidden);
  });
}

async function applyFileResult(result) {
  if (!result || result.canceled) return;
  loadFile(result.filePath || '', result.content || '');
}

window.addEventListener('DOMContentLoaded', async () => {
  if (window.electronAPI && typeof window.electronAPI.getInitialFile === 'function') {
    const res = await window.electronAPI.getInitialFile();
    await applyFileResult(res);
  }
});

if (window.electronAPI && typeof window.electronAPI.onAutoOpen === 'function') {
  window.electronAPI.onAutoOpen(async (res) => applyFileResult(res));
}

// Live preview: debounced render on every keystroke
let renderTimer = null;
editor.addEventListener('input', () => {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(render, 150);
  updateStatus();
});

// Search
let lastSearchTerm = '';
let lastSearchIndex = 0;
let findTerm = '';
let findIndex = 0;

function clearFindMarks() {
  preview.querySelectorAll('.find-mark').forEach(m => {
    m.replaceWith(document.createTextNode(m.textContent));
  });
  try { preview.normalize(); } catch (e) {}
}

function applyFindMarks(term) {
  clearFindMarks();
  if (!term) return 0;
  const lterm = term.toLowerCase();
  const walker = document.createTreeWalker(preview, NodeFilter.SHOW_TEXT, null);
  const ranges = [];
  let node;
  while ((node = walker.nextNode())) {
    const ltext = node.textContent.toLowerCase();
    let i = 0;
    while ((i = ltext.indexOf(lterm, i)) !== -1) {
      const range = document.createRange();
      range.setStart(node, i);
      range.setEnd(node, i + term.length);
      ranges.push(range);
      i++;
    }
  }
  ranges.reverse().forEach(range => {
    try {
      const mark = document.createElement('mark');
      mark.className = 'find-mark';
      range.surroundContents(mark);
    } catch (e) {}
  });
  return preview.querySelectorAll('.find-mark').length;
}

function doFind() {
  const q = searchBox.value;
  if (!q) return;

  const previewVisible = !preview.classList.contains('hidden');
  const editorVisible = !editor.classList.contains('hidden');

  if (previewVisible) {
    if (q !== findTerm) { findTerm = q; findIndex = 0; applyFindMarks(q); }
    else findIndex++;
    const marks = [...preview.querySelectorAll('.find-mark')];
    if (marks.length === 0) {
      searchBox.classList.add('search-no-results');
      setTimeout(() => searchBox.classList.remove('search-no-results'), 600);
      return;
    }
    findIndex = findIndex % marks.length;
    marks.forEach((m, i) => m.classList.toggle('find-mark-current', i === findIndex));
    marks[findIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else if (editorVisible) {
    if (q !== lastSearchTerm) { lastSearchTerm = q; lastSearchIndex = 0; }
    const text = editor.value;
    const ltext = text.toLowerCase();
    let found = ltext.indexOf(q.toLowerCase(), lastSearchIndex);
    if (found === -1) found = ltext.indexOf(q.toLowerCase(), 0);
    if (found === -1) {
      searchBox.classList.add('search-no-results');
      setTimeout(() => searchBox.classList.remove('search-no-results'), 600);
      return;
    }
    editor.focus();
    editor.setSelectionRange(found, found + q.length);
    editor.scrollTop = editor.scrollHeight * (found / text.length);
    lastSearchIndex = found + q.length;
  }
}

searchBox.addEventListener('keydown', (e) => { if (e.key === 'Enter') doFind(); });
searchBox.addEventListener('input', () => {
  if (!searchBox.value) { clearFindMarks(); findTerm = ''; findIndex = 0; }
});
findNextBtn.addEventListener('click', doFind);

// Scroll sync between editor and preview
let _scrollSyncing = false;

function syncScroll(source, target) {
  if (_scrollSyncing) return;
  _scrollSyncing = true;
  const scrollable = source.scrollHeight - source.clientHeight;
  if (scrollable > 0) {
    const ratio = source.scrollTop / scrollable;
    target.scrollTop = ratio * (target.scrollHeight - target.clientHeight);
  }
  requestAnimationFrame(() => { _scrollSyncing = false; });
}

function bothPanelsVisible() {
  return !editor.classList.contains('hidden') && !preview.classList.contains('hidden');
}

editor.addEventListener('scroll', () => { if (bothPanelsVisible()) syncScroll(editor, preview); });
preview.addEventListener('scroll', () => { if (bothPanelsVisible()) syncScroll(preview, editor); });

// Export dropdown
async function handleExport(format) {
  if (!editor.value.trim()) {
    alert('Nothing to export — paste some Markdown first.');
    return;
  }
  exportBtn.disabled = true;
  exportBtn.textContent = 'Exporting...';
  try {
    const defaultName = currentFilePath
      ? currentFilePath.split(/[\\/]/).pop().replace(/\.[^.]+$/, '')
      : 'document';
    let result;
    if (format === 'pdf') {
      const cssText = await window.electronAPI.getStylesCss();
      result = await window.electronAPI.exportFile('pdf', { renderedHtml: preview.innerHTML, cssText, defaultName });
    } else if (format === 'html') {
      const cssText = await window.electronAPI.getStylesCss();
      result = await window.electronAPI.exportFile('html', { renderedHtml: preview.innerHTML, cssText, defaultName });
    } else if (format === 'docx') {
      result = await window.electronAPI.exportFile('docx', { markdown: editor.value, defaultName });
    }
    if (result && result.success) {
      const savedName = result.savedPath.split(/[\\/]/).pop();
      const statusLeft = document.getElementById('statusLeft');
      if (statusLeft) {
        statusLeft.textContent = `Saved: ${savedName}`;
        setTimeout(() => updateStatus(), 3000);
      }
    } else if (result && !result.canceled) {
      alert('Export failed: ' + (result.error || 'Unknown error'));
    }
  } catch (e) {
    alert('Export failed: ' + e.message);
  } finally {
    exportBtn.disabled = false;
    exportBtn.textContent = 'Export ▾';
  }
}

if (exportBtn && exportMenu) {
  exportBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    exportMenu.classList.toggle('open');
  });

  document.addEventListener('click', () => {
    exportMenu.classList.remove('open');
    if (overflowMenu) overflowMenu.classList.remove('open');
  });

  exportMenu.addEventListener('click', (e) => e.stopPropagation());

  document.querySelectorAll('.dropdown-item').forEach((item) => {
    item.addEventListener('click', async () => {
      exportMenu.classList.remove('open');
      if (exportBtn.disabled) return;
      await handleExport(item.dataset.format);
    });
  });
}

// Overflow toolbar — measure actual overflow instead of fixed pixel thresholds
function updateToolbarOverflow() {
  const toolbar = document.querySelector('.toolbar');
  const p2Els = document.querySelectorAll('[data-overflow-priority="2"]');
  const p3Els = document.querySelectorAll('[data-overflow-priority="3"]');

  // Reset: show everything, hide overflow button
  p2Els.forEach(el => { el.style.display = ''; });
  p3Els.forEach(el => { el.style.display = ''; });
  if (overflowBtn) overflowBtn.style.display = 'none';

  let p2Hidden = false;
  let p3Hidden = false;

  const spacer = toolbar.querySelector('.toolbar-spacer');
  const tooTight = toolbar.scrollWidth > toolbar.clientWidth || (spacer && spacer.offsetWidth < 24);

  if (tooTight) {
    // Hide priority-2 (secondary tools), show overflow button
    p2Els.forEach(el => { el.style.display = 'none'; });
    if (overflowBtn) overflowBtn.style.display = 'inline-block';
    p2Hidden = true;

    // Still overflowing or tight? Hide priority-3 (theme/font) too
    const stillTight = toolbar.scrollWidth > toolbar.clientWidth || (spacer && spacer.offsetWidth < 24);
    if (stillTight) {
      p3Els.forEach(el => { el.style.display = 'none'; });
      p3Hidden = true;
    }
  }

  if (ovfRecentSection) ovfRecentSection.style.display = p2Hidden ? '' : 'none';
  if (ovfActionsSection) ovfActionsSection.style.display = p2Hidden ? '' : 'none';
  if (ovfSearchSection) ovfSearchSection.style.display = p2Hidden ? '' : 'none';
  if (ovfSettingsSection) ovfSettingsSection.style.display = p3Hidden ? '' : 'none';

  if (!p2Hidden && overflowMenu) overflowMenu.classList.remove('open');
}

if (overflowBtn && overflowMenu) {
  overflowBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    overflowMenu.classList.toggle('open');
  });
  overflowMenu.addEventListener('click', (e) => e.stopPropagation());
}

if (ovfRecentFiles) {
  ovfRecentFiles.addEventListener('change', () => {
    const idx = ovfRecentFiles.value;
    if (idx === '') return;
    recentFilesSelect.value = idx;
    recentFilesSelect.dispatchEvent(new Event('change'));
    ovfRecentFiles.value = '';
    overflowMenu.classList.remove('open');
  });
}

if (ovfBeautifyBtn) ovfBeautifyBtn.addEventListener('click', () => { overflowMenu.classList.remove('open'); beautifyBtn.click(); });
if (ovfMinifyBtn) ovfMinifyBtn.addEventListener('click', () => { overflowMenu.classList.remove('open'); minifyBtn.click(); });

document.querySelectorAll('.ovf-export-item').forEach((item) => {
  item.addEventListener('click', async () => {
    overflowMenu.classList.remove('open');
    await handleExport(item.dataset.format);
  });
});

if (ovfFindBtn) {
  ovfFindBtn.addEventListener('click', () => {
    searchBox.value = ovfSearchBox.value;
    overflowMenu.classList.remove('open');
    doFind();
  });
}
if (ovfSearchBox) {
  ovfSearchBox.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { searchBox.value = ovfSearchBox.value; doFind(); }
  });
}
if (ovfThemeToggle) ovfThemeToggle.addEventListener('change', () => applyTheme(ovfThemeToggle.value));
if (ovfFontSize) {
  ovfFontSize.addEventListener('input', () => {
    fontSize.value = ovfFontSize.value;
    fontSize.dispatchEvent(new Event('input'));
  });
}

new ResizeObserver(() => {
  updateToolbarOverflow();
  updateStatus();
}).observe(document.querySelector('.toolbar'));

// --- Startup ---
updateFormatButtons();
const savedTheme = localStorage.getItem('theme') || 'github';
const savedFontSize = localStorage.getItem('fontSize') || '14';
fontSize.value = savedFontSize;
editor.style.fontSize = savedFontSize + 'px';
preview.style.fontSize = savedFontSize + 'px';
if (ovfFontSize) ovfFontSize.value = savedFontSize;
applyTheme(savedTheme);
setEditorVisible(true);
setPreviewVisible(true);
loadRecentFiles();
render();
updateStatus();
updateToolbarOverflow();
