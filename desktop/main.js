const { app, BrowserWindow } = require("electron");
const path = require("path");

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./deskassistant.db');

// Create the log table
db.run(`CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    old_name TEXT,
    new_name TEXT,
    file_path TEXT,
    date DATETIME DEFAULT CURRENT_TIMESTAMP
)`);


function createWindow() {
  const win = new BrowserWindow({
    width: 500,
    height: 600
  });

  win.loadFile(path.join(__dirname, "index.html"));
}

app.whenReady().then(createWindow);
