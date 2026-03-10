// preload.js

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("deskAI", {
  // AI Commands
  aiCommand: (msg) => ipcRenderer.invoke("ai-command", msg),
  
  // File Operations
  scanFiles: () => ipcRenderer.invoke("scan:files"),
  applyRename: (actions) => ipcRenderer.invoke("rename:apply", actions),
  undoRename: () => ipcRenderer.invoke("rename:undo"),
  openFile: (filePath) => ipcRenderer.invoke("file:open", filePath),
  openLocation: (filePath) => ipcRenderer.invoke("file:open-location", filePath),
  deleteFile: (filePath) => ipcRenderer.invoke("file:delete", filePath),
  mergePdfs: (filePaths) => ipcRenderer.invoke("file:merge-pdfs", filePaths),
  
  // Activity Log
  getActivityLog: (filter) => ipcRenderer.invoke("db:get-activity-log", filter),
  deleteActivity: (id) => ipcRenderer.invoke("db:delete-activity", id),
  clearActivityLog: () => ipcRenderer.invoke("db:clear-activity"),
  
  // App Info & Stats
  getVersion: () => ipcRenderer.invoke("app:getVersion"),
  getSystemStats: () => ipcRenderer.invoke("system:get-stats"),
  
  // Extra Utilities
  openExternal: (url) => ipcRenderer.invoke("util:open-external", url),
  
  // Quick Actions
  quickAction: (action, query) => ipcRenderer.invoke("action:quick", action, query),

  // File Watcher
  onFileEvent: (callback) => ipcRenderer.on("file:event", (event, data) => callback(data)),
  startWatcher: () => ipcRenderer.invoke("watcher:start"),
  stopWatcher: () => ipcRenderer.invoke("watcher:stop"),

  // Settings Persistence
  saveSetting: (key, value) => ipcRenderer.invoke("settings:save", { key, value }),
  getSetting: (key) => ipcRenderer.invoke("settings:get", key),

  // Ollama Setup
  checkOllamaStatus: () => ipcRenderer.invoke("ollama:check-status"),
  openOllamaWebsite: () => ipcRenderer.invoke("ollama:open-website"),
});
