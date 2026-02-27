const { contextBridge, ipcRenderer } = require('electron');

// Delegate heavy/third-party module usage to the main process to avoid preload bundling issues.
contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  renderMarkdown: (text, filePath) => ipcRenderer.invoke('render:markdown', text, filePath),
  beautify: (text, filePath) => ipcRenderer.invoke('format:beautify', text, filePath),
  minify: (text, filePath) => ipcRenderer.invoke('format:minify', text, filePath),

  // initial/auto open helpers
  getInitialFile: () => ipcRenderer.invoke('get-initial-file'),
  onAutoOpen: (callback) => ipcRenderer.on('auto-open', (event, data) => callback(data))
});
