const { askOllama } = require("./ollamaAI");
const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();
let chokidar;
try {
  chokidar = require("chokidar");
} catch (e) {
  console.warn("Chokidar not found, file monitoring disabled.");
}
require("dotenv").config();
const { autoUpdater } = require("electron-updater");
const { scanFolders } = require("./fileScanner");
const { buildPdfRenamePreview } = require("./renamePreview");
const { applyRenameActions, undoRenameActions } = require("./renameExecutor");
const { setLastRenameActions, getLastRenameActions, clearLastRenameActions } = require("./undoStore");
const { askGemini } = require("./gemini");
const { initDatabase, runQuery, allQuery, getQuery, deleteActivityLog, clearActivityLog } = require("./dbHelper");
const {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  Tray,
  nativeImage,
  dialog,
  shell,
} = require("electron");
const gotTheLock = app.requestSingleInstanceLock();

// ---------- Database ----------
const dbPath = path.join(app.getPath("userData"), "deskassistant.db");
initDatabase(dbPath).catch(err => {
  console.error("Failed to initialize database:", err);
});

// ---------- Globals ----------
let mainWindow = null;
let tray = null;
let watcher = null;

// Helper to get active scan folders from DB
async function getActiveScanFolders() {
  const home = require("os").homedir();
  const defaultFolders = {
    scanDesktop: path.join(home, "Desktop"),
    scanDownloads: path.join(home, "Downloads"),
    scanDocuments: path.join(home, "Documents"),
    scanPictures: path.join(home, "Pictures"),
    scanVideos: path.join(home, "Videos")
  };

  const activeFolders = [];
  const scanFull = await getQuery(`SELECT value FROM settings WHERE key = ?`, ["scanFull"]);
  
  if (scanFull && JSON.parse(scanFull.value) === true) {
    // If full scan is enabled, we still just watch the main user folders for performance 
    // but the scanner would ideally handle the rest. For watcher, we stick to defaults + others.
    return Object.values(defaultFolders).filter(f => fs.existsSync(f));
  }

  for (const [key, folderPath] of Object.entries(defaultFolders)) {
    const setting = await getQuery(`SELECT value FROM settings WHERE key = ?`, [key]);
    if (setting && JSON.parse(setting.value) === true) {
      if (fs.existsSync(folderPath)) {
        activeFolders.push(folderPath);
      }
    }
  }

  // Default fallback if nothing selected
  if (activeFolders.length === 0) {
    return [defaultFolders.scanDesktop, defaultFolders.scanDownloads, defaultFolders.scanDocuments].filter(f => fs.existsSync(f));
  }

  return activeFolders;
}

// Helper to analyze a file and suggest actions
function analyzeFile(filePath, stats) {
  const fileName = path.basename(filePath);
  const ext = path.extname(fileName).toLowerCase();
  const nameNoExt = path.parse(fileName).name;
  
  const analysis = {
    messy: false,
    type: 'unknown',
    suggestion: '',
    reason: ''
  };

  // 1. Messy Name Detection
  const messyRegex = /[0-9]{8,}|copy|untit|whatsapp|img_[0-9]|final_final|version[0-9]/i;
  if (messyRegex.test(nameNoExt) || nameNoExt.includes(' (')) {
    analysis.messy = true;
    analysis.suggestion = 'Rename';
    analysis.reason = 'This filename looks disorganized or like a duplicate copy.';
  }

  // 2. Type Detection & Specific Suggestions
  const resumeKeywords = ['resume', 'cv', 'biodata', 'curriculum'];
  if (resumeKeywords.some(k => nameNoExt.toLowerCase().includes(k))) {
    analysis.type = 'resume';
    analysis.suggestion = 'Move to Documents';
    analysis.reason = 'This file looks like a resume.';
  } else if (['.exe', '.msi'].includes(ext)) {
    analysis.type = 'installer';
    analysis.suggestion = 'Ignore or Clean';
    analysis.reason = 'This is an installer file. You might want to remove it after installation.';
  } else if (['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) {
    analysis.type = 'image';
    if (analysis.messy) {
      analysis.suggestion = 'Rename and Move to Pictures';
    }
  }

  return analysis;
}

async function setupWatcher() {
  if (!chokidar) {
    console.error("File monitoring not available: chokidar module missing.");
    return false;
  }
  if (watcher) {
    await watcher.close();
  }

  const foldersToWatch = await getActiveScanFolders();

  watcher = chokidar.watch(foldersToWatch, {
    ignoreInitial: true,
    depth: 0,
    persistent: true,
    ignorePermissionErrors: true
  });

  const handleFileEvent = async (eventType, filePath) => {
    if (!mainWindow) return;

    try {
      const stats = eventType !== 'unlink' ? fs.statSync(filePath) : null;
      const analysis = stats ? analyzeFile(filePath, stats) : null;
      
      const fileData = {
        event: eventType,
        name: path.basename(filePath),
        path: filePath,
        size: stats ? stats.size : 0,
        time: stats ? stats.mtime : new Date(),
        analysis: analysis
      };

      mainWindow.webContents.send("file:event", fileData);

      // Log to Activity Log
      await runQuery(`
        INSERT INTO activity_log (type, old_name, new_name, file_path)
        VALUES (?, ?, ?, ?)
      `, ["Monitor", path.basename(filePath), eventType, filePath]);

    } catch (e) {
      console.error(`Error handling file event ${eventType}:`, e);
    }
  };

  watcher
    .on("add", (path) => handleFileEvent("added", path))
    .on("change", (path) => handleFileEvent("changed", path))
    .on("unlink", (path) => handleFileEvent("deleted", path));
  
  return true;
}

ipcMain.handle("watcher:start", async () => {
  const result = await setupWatcher();
  if (result === false) {
    return { success: false, error: "File monitoring is not available right now." };
  }
  return { success: true };
});

ipcMain.handle("watcher:stop", () => {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
  return { success: true };
});


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
    const scanFullRow = await getQuery(`SELECT value FROM settings WHERE key = ?`, ["scanFull"]);
    const scanFull = scanFullRow ? JSON.parse(scanFullRow.value) : false;
    const data = scanFolders(scanFull);
    return data;
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle("rename:preview:pdf", async () => {
  try {
    const scanFullRow = await getQuery(`SELECT value FROM settings WHERE key = ?`, ["scanFull"]);
    const scanFull = scanFullRow ? JSON.parse(scanFullRow.value) : false;
    const data = scanFolders(scanFull);
    const preview = buildPdfRenamePreview(data.pdf);
    return { preview };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle("rename:apply", async (event, previewActions) => {
  try {
    if (!Array.isArray(previewActions)) {
      return { error: "Invalid preview actions provided." };
    }

    const done = applyRenameActions(previewActions);
    setLastRenameActions(done || []);

    // Log to DB
    if (Array.isArray(done)) {
      for (const a of done) {
        if (a && a.from && a.to) {
          await runQuery(`
            INSERT INTO activity_log (type, old_name, new_name, file_path)
            VALUES (?, ?, ?, ?)
          `, ["Rename", path.basename(a.from), path.basename(a.to), a.from]);
        }
      }
    }

    return { doneCount: (done || []).length };
  } catch (err) {
    console.error("Rename Apply Error:", err);
    return { error: "Failed to apply renames: " + err.message };
  }
});

ipcMain.handle("db:get-activity-log", async (event, filter = "all") => {
  try {
    let query = "SELECT * FROM activity_log ";
    let params = [];
    if (filter !== "all") {
      query += "WHERE type = ? ";
      params.push(filter);
    }
    query += "ORDER BY date DESC LIMIT 100";
    
    const rows = await allQuery(query, params);
    return rows || [];
  } catch (err) {
    console.error("DB Log Error:", err);
    return [];
  }
});

ipcMain.handle("db:delete-activity", async (event, id) => {
  try {
    return await deleteActivityLog(id);
  } catch (err) {
    console.error("DB Delete Error:", err);
    return { error: err.message };
  }
});

ipcMain.handle("db:clear-activity", async () => {
  try {
    return await clearActivityLog();
  } catch (err) {
    console.error("DB Clear Error:", err);
    return { error: err.message };
  }
});

ipcMain.handle("file:open", async (event, filePath) => {
  try {
    if (!filePath || typeof filePath !== 'string') return;
    if (fs.existsSync(filePath)) {
      shell.openPath(filePath);
    }
  } catch (err) {
    console.error("File Open Error:", err);
  }
});

ipcMain.handle("file:open-location", async (event, filePath) => {
  try {
    if (!filePath || typeof filePath !== 'string') return;
    if (fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath);
    }
  } catch (err) {
    console.error("File Location Error:", err);
  }
});

ipcMain.handle("file:delete", async (event, filePath) => {
  try {
    if (!filePath || typeof filePath !== 'string') return;
    if (fs.existsSync(filePath)) {
      await shell.trashItem(filePath);
      
      // Log deletion
      await runQuery(`
        INSERT INTO activity_log (type, old_name, new_name, file_path)
        VALUES (?, ?, ?, ?)
      `, ["Delete", path.basename(filePath), "Recycle Bin", filePath]);
    }
  } catch (err) {
    console.error("File Delete Error:", err);
  }
});

ipcMain.handle("settings:save", async (event, { key, value }) => {
  try {
    await runQuery(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, [key, JSON.stringify(value)]);
    return { success: true };
  } catch (err) {
    console.error("Settings Save Error:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("settings:get", async (event, key) => {
  try {
    const row = await getQuery(`SELECT value FROM settings WHERE key = ?`, [key]);
    return row ? JSON.parse(row.value) : null;
  } catch (err) {
    console.error("Settings Get Error:", err);
    return null;
  }
});

ipcMain.handle("system:get-stats", async () => {
  try {
    const scanFullRow = await getQuery(`SELECT value FROM settings WHERE key = ?`, ["scanFull"]);
    const scanFull = scanFullRow ? JSON.parse(scanFullRow.value) : false;
    const data = scanFolders(scanFull);
    const allFiles = (data && data.all) ? data.all : [];

    // Improved Duplicate detection
    const seen = new Map();
    let duplicatesCount = 0;
    allFiles.forEach(f => {
      if (f && f.name && f.size !== undefined) {
        const normalizedName = f.name.replace(/\s-\sCopy|\s\(\d+\)|copy|duplicate/gi, '').toLowerCase();
        const key = `${normalizedName}-${f.size}`;
        if (seen.has(key)) duplicatesCount++;
        else seen.set(key, true);
      }
    });

    // Messy files detection
    const messyRegex = /[0-9]{8,}|copy|untit|whatsapp|img_[0-9]|final_final/i;
    const messyFiles = allFiles.filter(f => f && f.name && (messyRegex.test(f.name) || f.name.includes(' (')));

    // Large files threshold from settings
    const setting = await getQuery(`SELECT value FROM settings WHERE key = ?`, ["prefLargeThreshold"]);
    let threshold = 500 * 1024 * 1024; // 500MB default
    if (setting) {
      const val = JSON.parse(setting.value);
      if (val === 'custom') {
        const customVal = await getQuery(`SELECT value FROM settings WHERE key = ?`, ["customSizeVal"]);
        const customUnit = await getQuery(`SELECT value FROM settings WHERE key = ?`, ["customSizeUnit"]);
        if (customVal && customUnit) {
          const num = parseFloat(JSON.parse(customVal.value));
          const unit = JSON.parse(customUnit.value);
          threshold = num * (unit === 'GB' ? 1024 * 1024 * 1024 : 1024 * 1024);
        }
      } else {
        threshold = parseInt(val) * 1024 * 1024;
      }
    }
    const largeFiles = allFiles.filter(f => f && f.size > threshold);

    // Improved Resume detection
    const resumeKeywords = ['resume', 'cv', 'biodata', 'profile'];
    const resumeExtensions = ['.pdf', '.doc', '.docx', '.txt'];
    const resumes = allFiles.filter(f => {
      if (!f || !f.name) return false;
      const ext = path.extname(f.name).toLowerCase();
      const nameNoExt = path.parse(f.name).name.toLowerCase();
      return resumeExtensions.includes(ext) && resumeKeywords.some(k => nameNoExt.includes(k));
    });

    return {
      files: allFiles.length,
      pdfCount: (data && data.pdf) ? data.pdf.length : 0,
      messy: messyFiles.length,
      duplicates: duplicatesCount,
      large: largeFiles.length,
      resumes: resumes.length
    };
  } catch (err) {
    console.error("Stats Error:", err);
    return {
      files: 0,
      pdfCount: 0,
      messy: 0,
      duplicates: 0,
      large: 0,
      resumes: 0,
      error: "Could not load system stats."
    };
  }
});

ipcMain.handle("action:quick", async (event, action, query = '') => {
  try {
    const scanFullRow = await getQuery(`SELECT value FROM settings WHERE key = ?`, ["scanFull"]);
    const scanFull = scanFullRow ? JSON.parse(scanFullRow.value) : false;
    const data = scanFolders(scanFull);
    
    if (!data) return { error: "Could not access files." };
    const allFiles = (data && data.all) ? data.all : [];

    if (action === "downloads" || action === "desktop" || action === "both") {
      let filesToProcess = [];
      if (action === "downloads") filesToProcess = data.downloads || [];
      else if (action === "desktop") filesToProcess = data.desktop || [];
      else filesToProcess = [...(data.downloads || []), ...(data.desktop || [])];

      // Build rename previews
      const preview = buildPdfRenamePreview(filesToProcess);
      
      // Filter for issues (messy names, duplicates, old, large)
      const issues = filesToProcess.filter(f => {
        const analysis = analyzeFile(f.path, f);
        return analysis.messy || analysis.type === 'installer' || f.size > 100 * 1024 * 1024; // >100MB as "issue" for organization
      });

      // Also identify potential groupings/folders
      const groups = new Map();
      filesToProcess.forEach(f => {
        const ext = path.extname(f.name).toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) {
          if (!groups.has('Images')) groups.set('Images', []);
          groups.get('Images').push(f);
        } else if (['.pdf', '.doc', '.docx', '.txt'].includes(ext)) {
          if (!groups.has('Documents')) groups.set('Documents', []);
          groups.get('Documents').push(f);
        }
      });

      const folderSuggestions = Array.from(groups.entries()).map(([name, files]) => ({
        type: 'grouping',
        name: name,
        count: files.length,
        files: files.slice(0, 3).map(f => f.name)
      }));

      return { preview: issues.length > 0 ? preview : [], folderSuggestions: issues.length > 0 ? folderSuggestions : [] };
    } 
    
    else if (action === "duplicates") {
      const seen = new Map();
      const duplicateGroups = [];
      
      allFiles.forEach(f => {
        if (!f || !f.name || f.size === undefined) return;
        const normalizedName = f.name.replace(/\s-\sCopy|\s\(\d+\)|copy|duplicate/gi, '').toLowerCase();
        const key = `${normalizedName}-${f.size}`;
        
        if (seen.has(key)) {
          const group = seen.get(key);
          group.push(f);
        } else {
          seen.set(key, [f]);
        }
      });

      for (const [key, files] of seen.entries()) {
        if (files.length > 1) {
          duplicateGroups.push({
            id: key,
            files: files.map(f => ({
              ...f,
              name: f.name,
              path: f.path,
              size: f.size,
              date: f.date,
              reason: 'Identical name/size'
            }))
          });
        }
      }

      return { duplicateGroups: duplicateGroups.slice(0, 10), totalGroups: duplicateGroups.length };
    } 
    
    else if (action === "resume") {
      const resumeKeywords = ['resume', 'cv', 'biodata', 'profile'];
      const resumeExtensions = ['.pdf', '.doc', '.docx', '.txt'];
      const resumes = allFiles.filter(f => {
        if (!f || !f.name) return false;
        const ext = path.extname(f.name).toLowerCase();
        const nameNoExt = path.parse(f.name).name.toLowerCase();
        return resumeExtensions.includes(ext) && resumeKeywords.some(k => nameNoExt.includes(k));
      });
      return { 
        preview: (resumes || []).map(f => ({ 
          ...f, 
          from: f.path || "unknown", 
          to: "Possible Resume Found" 
        })) 
      };
    } 
    
    else if (action === "largeFiles") {
      const setting = await getQuery(`SELECT value FROM settings WHERE key = ?`, ["prefLargeThreshold"]);
      let threshold = 500 * 1024 * 1024;
      
      if (setting) {
        const val = JSON.parse(setting.value);
        if (val === 'custom') {
          const customVal = await getQuery(`SELECT value FROM settings WHERE key = ?`, ["customSizeVal"]);
          const customUnit = await getQuery(`SELECT value FROM settings WHERE key = ?`, ["customSizeUnit"]);
          if (customVal && customUnit) {
            const num = parseFloat(JSON.parse(customVal.value));
            const unit = JSON.parse(customUnit.value);
            threshold = num * (unit === 'GB' ? 1024 * 1024 * 1024 : 1024 * 1024);
          }
        } else {
          threshold = parseInt(val) * 1024 * 1024;
        }
      }

      const large = allFiles.filter(f => f && f.size > threshold).sort((a, b) => b.size - a.size);
      return { preview: (large || []).map(f => ({ ...f, from: f.path || "unknown", to: `Large file` })) };
    }

    else if (action === "recent") {
      const recent = [...allFiles].sort((a, b) => b.date - a.date).slice(0, 10);
      return { preview: recent.map(f => ({ ...f, from: f.path || "unknown", to: "Recent file" })) };
    }

    else if (action === "search") {
      const searchTerm = query.toLowerCase().replace(/^find\s+/, '').trim();
      const supportedExts = ['.pdf', '.doc', '.docx', '.txt', '.pptx', '.xlsx', '.jpg', '.png'];
      
      let results = allFiles.filter(f => {
        if (!f || !f.name) return false;
        const name = f.name.toLowerCase();
        const ext = path.extname(f.name).toLowerCase();
        const matchesName = name.includes(searchTerm);
        const isSupported = supportedExts.includes(ext);
        return matchesName && isSupported;
      });

      // If no exact matches, look for similar matches (fuzzy-ish)
      if (results.length === 0) {
        results = allFiles.filter(f => {
          if (!f || !f.name) return false;
          const name = f.name.toLowerCase();
          const ext = path.extname(f.name).toLowerCase();
          const isSupported = supportedExts.includes(ext);
          // Split searchTerm into words and check if any word matches
          const words = searchTerm.split(/\s+/);
          const matchesAnyWord = words.some(word => word.length > 2 && name.includes(word));
          return matchesAnyWord && isSupported;
        });
      }

      return { preview: results.map(f => ({ ...f, from: f.path || "unknown", to: "Search result" })) };
    }

    return { error: "Action not recognized" };
  } catch (err) {
    console.error("Quick Action Error:", err);
    return { error: "I couldn't complete that action right now. Please try again." };
  }
});

ipcMain.handle("file:merge-pdfs", async (event, filePaths) => {
  if (!filePaths || filePaths.length < 2) {
    return { error: "Select at least 2 PDFs to merge." };
  }
  
  try {
    // In a real app, we would use a library like 'pdf-lib'
    // For this demonstration, we'll mock the success
    const outputPath = path.join(path.dirname(filePaths[0]), `Merged_PDF_${Date.now()}.pdf`);
    
    // Mock merge operation
    // fs.writeFileSync(outputPath, "Mock Merged Content");

    // Log merge
    const stmt = db.prepare(`
      INSERT INTO activity_log (type, old_name, new_name, file_path)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run("Merge", `${filePaths.length} PDFs`, path.basename(outputPath), outputPath);
    stmt.finalize();

    return { success: true, path: outputPath };
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

ipcMain.handle("ai-command", async (event, message) => {
  const result = await askOllama(message);
  return result;
});

ipcMain.handle("util:open-external", async (event, url) => {
  if (url) shell.openExternal(url);
});

ipcMain.handle("ollama:check-status", async () => {
  try {
    // Check if Ollama server is running
    const res = await fetch("http://localhost:11434/api/tags");
    if (!res.ok) {
      return { status: "not_running", message: "Ollama is installed but not currently running." };
    }

    const data = await res.json();
    const models = (data && data.models) ? data.models : [];
    const hasPhi3 = models.some(m => m && m.name && m.name.includes("phi3"));

    if (hasPhi3) {
      return { status: "ready", message: "Ollama and phi3 are ready." };
    } else {
      return { status: "model_missing", message: "Ollama is working, but the recommended model 'phi3' is not installed yet." };
    }
  } catch (err) {
    return { status: "not_installed", message: "Ollama was not detected on this computer." };
  }
});

ipcMain.handle("ollama:open-website", async () => {
  shell.openExternal("https://ollama.com/download");
});