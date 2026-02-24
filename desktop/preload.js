const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("deskAI", {
  // Existing scan (you already have)
  ask: (prompt) => ipcRenderer.invoke("ai:ask", prompt),
  scanFiles: () => ipcRenderer.invoke("scan:files"),

  // PDF rename preview + apply + undo (NEW)
  pdfRenamePreview: () => ipcRenderer.invoke("rename:preview:pdf"),
  applyRename: (actions) => ipcRenderer.invoke("rename:apply", actions),
  undoRename: () => ipcRenderer.invoke("rename:undo")
});
