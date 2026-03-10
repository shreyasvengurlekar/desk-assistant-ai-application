const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

let db;

function initDatabase(dbPath) {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error("❌ Database connection error:", err.message);
        return reject(err);
      }
      console.log("✅ Connected to SQLite database.");
      
      // Initialize tables
      db.serialize(() => {
        // Activity Log Table
        db.run(`
          CREATE TABLE IF NOT EXISTS activity_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT,
            old_name TEXT,
            new_name TEXT,
            file_path TEXT,
            date DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) console.error("❌ Error creating activity_log table:", err.message);
        });

        // Settings Table
        db.run(`
          CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
          )
        `, (err) => {
          if (err) console.error("❌ Error creating settings table:", err.message);
        });
      });
      resolve();
    });
  });
}

function runQuery(sql, params = []) {
  return new Promise((resolve) => {
    if (!db) {
      console.error("❌ Database not initialized.");
      return resolve({ error: "Database not ready" });
    }
    db.run(sql, params, function(err) {
      if (err) {
        console.error("❌ Query error:", err.message);
        return resolve({ error: err.message });
      }
      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function allQuery(sql, params = []) {
  return new Promise((resolve) => {
    if (!db) {
      console.error("❌ Database not initialized.");
      return resolve([]);
    }
    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error("❌ Select error:", err.message);
        return resolve([]);
      }
      resolve(rows || []);
    });
  });
}

function getQuery(sql, params = []) {
  return new Promise((resolve) => {
    if (!db) {
      console.error("❌ Database not initialized.");
      return resolve(null);
    }
    db.get(sql, params, (err, row) => {
      if (err) {
        console.error("❌ Get error:", err.message);
        return resolve(null);
      }
      resolve(row || null);
    });
  });
}

module.exports = {
  initDatabase,
  runQuery,
  allQuery,
  getQuery
};
