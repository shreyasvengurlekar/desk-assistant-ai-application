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

contextBridge.exposeInMainWorld("updater", {

  check: () => ipcRenderer.invoke("update:check"),

  download: () => ipcRenderer.invoke("update:download"),

  install: () => ipcRenderer.invoke("update:install")

});

contextBridge.exposeInMainWorld("appInfo", {
  getVersion: () => ipcRenderer.invoke("app:getVersion"),
  isPackaged: () => ipcRenderer.invoke("app:isPackaged"),
});