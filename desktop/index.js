const { ipcMain } = require("electron");
const { scanFolders } = require("./fileScanner");
const { buildPdfRenamePreview } = require("./renamePreview");
const { applyRenameActions, undoRenameActions } = require("./renameExecutor");
const { setLastRenameActions, getLastRenameActions, clearLastRenameActions } = require("./undoStore");

require("dotenv").config();
const { askGemini } = require("./gemini");

const { app, BrowserWindow, Tray, Menu } = require('electron');
const path = require('path');

let mainWindow;
let tray;

function createWindow() {
  mainWindow = new BrowserWindow({
  width: 1000,
  height: 700,
  show: false,
  webPreferences: {
    preload: path.join(__dirname, "preload.js"),
    contextIsolation: true
  }
});

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Hide instead of close
  mainWindow.on('close', (event) => {
    event.preventDefault();
    mainWindow.hide();
  });
}

app.whenReady().then(() => {
  createWindow();

  // Tray icon
  tray = new Tray(path.join(__dirname, 'assets', 'icon.png'));

  const trayMenu = Menu.buildFromTemplate([
    {
      label: 'Open Desk Assistant AI',
      click: () => {
        mainWindow.show();
      }
    },
    {
      label: 'Quit',
      click: () => {
        app.exit();
      }
    }
  ]);

  tray.setToolTip('Desk Assistant AI');
  tray.setContextMenu(trayMenu);

  tray.on('click', () => {
    mainWindow.show();
  });
});

//Gemini AI handler

ipcMain.handle("ai:ask", async (event, userPrompt) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return "❌ GEMINI_API_KEY missing in .env";

  try {
    const safePrompt = `
You are Desk Assistant AI.
Rules:
- Reply ONLY in bullet points.
- Use simple English, short lines.
- Mention "No files will be changed without approval."
User request: ${userPrompt}
`;

    const text = await askGemini(key, safePrompt);
    return text;
  } catch (err) {
    return "⚠️ AI is temporarily unavailable.\nShowing smart local suggestions instead.\n\nNo files will be changed without approval.";
  }
});

//File scanning handler/IPC Handler

ipcMain.handle("scan:files", async () => {
  try {
    const data = scanFolders();
    return data;
  } catch (err) {
    return { error: err.message };
  }
});

// Rename,undo,preview actions handlers

ipcMain.handle("rename:preview:pdf", async () => {
  try {
    const data = scanFolders(); // uses your existing scanner
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
    if (!last || last.length === 0) return { message: "Nothing to undo." };

    undoRenameActions(last);
    clearLastRenameActions();
    return { message: "Undo complete." };
  } catch (err) {
    return { error: err.message };
  }
});
