const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();
require("dotenv").config();
const { autoUpdater } = require("electron-updater");
const { scanFolders } = require("./fileScanner");
const { buildPdfRenamePreview } = require("./renamePreview");
const { applyRenameActions, undoRenameActions } = require("./renameExecutor");
const { setLastRenameActions, getLastRenameActions, clearLastRenameActions } = require("./undoStore");
const { askGemini } = require("./gemini");
const {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  Tray,
  nativeImage,
  dialog,
} = require("electron");
const gotTheLock = app.requestSingleInstanceLock();




// ---------- Database ----------
const db = new sqlite3.Database("./deskassistant.db");
db.run(`
  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    old_name TEXT,
    new_name TEXT,
    file_path TEXT,
    date DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// ---------- Globals ----------
let mainWindow = null;
let tray = null;


if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    // Someone tried to open a second instance, focus existing window instead
    if (mainWindow) {
      if (!mainWindow.isVisible()) mainWindow.show();
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}



// ---------- Window ----------
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    icon: path.join(__dirname, "assets", "icon.png"),
    minWidth: 900,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // Close button -> minimize to tray (only if tray exists)
  mainWindow.on("close", (e) => {
    if (tray && !app.isQuiting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

// ---------- Tray (PNG - reliable) ----------
function createTray() {
  const pngPath = path.join(__dirname, "assets", "icon.png");

  if (!fs.existsSync(pngPath)) {
    console.log("❌ Tray icon missing:", pngPath);
    return;
  }

  let trayImage = nativeImage.createFromPath(pngPath);
  if (trayImage.isEmpty()) {
    console.log("❌ Tray icon could not be loaded:", pngPath);
    return;
  }

  trayImage = trayImage.resize({ width: 16, height: 16 });

  tray = new Tray(trayImage);
  tray.setToolTip("Desk Assistant AI");

  const trayMenu = Menu.buildFromTemplate([
    {
      label: "Open",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        app.isQuiting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(trayMenu);

  // Left click toggles window
  tray.on("click", () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) mainWindow.hide();
    else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ---------- Auto Updater ----------
autoUpdater.on("checking-for-update", () => {
  mainWindow.webContents.send("update:checking");
});

autoUpdater.on("update-available", (info) => {
  mainWindow.webContents.send("update:available", info);
});

autoUpdater.on("download-progress", (progress) => {
  mainWindow.webContents.send("update:progress", progress);
});

autoUpdater.on("update-downloaded", () => {
  mainWindow.webContents.send("update:ready");
});

// Menu (Help -> Check for Updates)
const menuTemplate = [
  {
    label: "Help",
    submenu: [
      {
        label: "Check for Updates",
        click: async () => {
          try {
            // In dev mode this will usually be skipped; that's normal
            const result = await autoUpdater.checkForUpdates();

            const hasUpdate =
              !!result?.updateInfo &&
              Array.isArray(result.updateInfo.files) &&
              result.updateInfo.files.length > 0;

            await dialog.showMessageBox({
              message: hasUpdate
                ? `New update available! Latest: ${result.updateInfo.version}`
                : "You are using the latest version.",
              buttons: ["OK"],
            });
          } catch (err) {
            console.log("Update check failed:", err);
            await dialog.showMessageBox({
              message: "Update check failed. Please try again later.",
              buttons: ["OK"],
            });
          }
        },
      },
    ],
  },
];

// ---------- App Ready ----------
app.whenReady().then(() => {
  createWindow();
  createTray();

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  // Auto-check updates after startup (works when packed/installed)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => { });
  }, 3000);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ---------- IPC: updater (for renderer buttons) ----------
ipcMain.handle("update:check", async () => {
  const result = await autoUpdater.checkForUpdates();

  const hasUpdate =
    !!result?.updateInfo &&
    Array.isArray(result.updateInfo.files) &&
    result.updateInfo.files.length > 0;

  return {
    updateAvailable: hasUpdate,
    info: result?.updateInfo || null,
  };
});

ipcMain.handle("update:download", async () => {
  autoUpdater.autoDownload = true;
  await autoUpdater.downloadUpdate();
  return { ok: true };
});

ipcMain.handle("update:install", async () => {
  autoUpdater.quitAndInstall();
  return { ok: true };
});

ipcMain.handle("app:getVersion", () => app.getVersion());
ipcMain.handle("app:isPackaged", () => app.isPackaged);


ipcMain.handle("scan:files", async () => {
  try {
    const data = scanFolders();
    return data;
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle("rename:preview:pdf", async () => {
  try {
    const data = scanFolders();
    const preview = buildPdfRenamePreview(data.pdf);
    return { preview };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle("rename:apply", async (event, previewActions) => {
  try {
    const done = applyRenameActions(previewActions);
    setLastRenameActions(done);
    return { doneCount: done.length };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle("rename:undo", async () => {
  try {
    const last = getLastRenameActions();
    if (!last || last.length === 0) {
      return { message: "Nothing to undo." };
    }

    undoRenameActions(last);
    clearLastRenameActions();
    return { message: "Undo complete." };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle("ai:ask", async (event, prompt) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { error: "Gemini API key not found in .env" };
    }

    const result = await askGemini(apiKey, prompt);
    return { text: result };
  } catch (err) {
    return { error: err.message };
  }
});