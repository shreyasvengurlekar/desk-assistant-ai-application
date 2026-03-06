console.log("✅ preload.js loaded");

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("__preloadTest", {
  ping: () => "pong",
});

/* -------- Desk Assistant AI API -------- */

contextBridge.exposeInMainWorld("deskAI", {

  // Ask AI
  ask: (prompt) => ipcRenderer.invoke("ai:ask", prompt),

  // Scan files
  scanFiles: () => ipcRenderer.invoke("scan:files"),

  // PDF rename preview
  pdfRenamePreview: () => ipcRenderer.invoke("rename:preview:pdf"),

  // Apply rename
  applyRename: (actions) => ipcRenderer.invoke("rename:apply", actions),

  // Undo rename
  undoRename: () => ipcRenderer.invoke("rename:undo")

});


/* -------- App Updater API -------- */
contextBridge.exposeInMainWorld("updateEvents", {
  onChecking: (callback) => ipcRenderer.on("update:checking", callback),
  onAvailable: (callback) => ipcRenderer.on("update:available", callback),
  onProgress: (callback) => ipcRenderer.on("update:progress", callback),
  onReady: (callback) => ipcRenderer.on("update:ready", callback),
});

contextBridge.exposeInMainWorld("appInfo", {
  getVersion: () => ipcRenderer.invoke("app:getVersion"),
  isPackaged: () => ipcRenderer.invoke("app:isPackaged"),
});