const fs = require("fs");
const path = require("path");
const os = require("os");

function scanFolders(scanFull = false) {
  const home = os.homedir();
  let foldersToScan = [
    path.join(home, "Downloads"),
    path.join(home, "Desktop"),
    path.join(home, "Documents"),
    path.join(home, "Pictures"),
    path.join(home, "Videos")
  ];

  if (scanFull) {
    // Detect all drives (Windows)
    const drives = ['C:\\', 'D:\\', 'E:\\', 'F:\\', 'G:\\', 'H:\\', 'I:\\', 'J:\\'];
    drives.forEach(drive => {
      if (fs.existsSync(drive)) {
        try {
          const contents = fs.readdirSync(drive);
          contents.forEach(item => {
            const fullPath = path.join(drive, item);
            try {
              const stats = fs.statSync(fullPath);
              if (stats.isDirectory()) {
                const lowerItem = item.toLowerCase();
                const systemFolders = [
                  'windows', 'program files', 'program files (x86)', 
                  'appdata', 'system32', 'recycler', '$recycle.bin', 
                  'system volume information', 'boot', 'node_modules', '.git'
                ];
                if (!systemFolders.includes(lowerItem) && !item.startsWith('.')) {
                  foldersToScan.push(fullPath);
                }
              }
            } catch (e) {}
          });
        } catch (e) {}
      }
    });
  }

  const result = {
    pdf: [],
    images: [],
    installers: [],
    others: [],
    all: [],
    downloads: [],
    desktop: [],
    documents: []
  };

  const downloadsPath = path.join(home, "Downloads").toLowerCase();
  const desktopPath = path.join(home, "Desktop").toLowerCase();
  const documentsPath = path.join(home, "Documents").toLowerCase();

  const systemFolders = [
    'windows', 'program files', 'program files (x86)', 
    'appdata', 'system32', 'recycler', '$recycle.bin', 
    'system volume information', 'boot', 'node_modules', '.git'
  ];

  function walkSync(dir, depth = 0) {
    if (depth > (scanFull ? 5 : 2)) return; // Limit depth to avoid performance issues
    if (!fs.existsSync(dir)) return;

    try {
      const files = fs.readdirSync(dir);
      files.forEach(file => {
        try {
          const fullPath = path.join(dir, file);
          const stats = fs.lstatSync(fullPath);
          
          if (stats.isDirectory()) {
            const lowerDir = file.toLowerCase();
            if (!systemFolders.includes(lowerDir) && !file.startsWith('.')) {
              walkSync(fullPath, depth + 1);
            }
            return;
          }

          const ext = path.extname(file).toLowerCase();
          const fileObj = {
            name: file,
            path: fullPath,
            size: stats.size,
            date: stats.mtime,
            ext: ext
          };

          result.all.push(fileObj);
          
          const lowerPath = fullPath.toLowerCase();
          if (lowerPath.startsWith(downloadsPath)) result.downloads.push(fileObj);
          if (lowerPath.startsWith(desktopPath)) result.desktop.push(fileObj);
          if (lowerPath.startsWith(documentsPath)) result.documents.push(fileObj);

          if (ext === ".pdf") result.pdf.push(fullPath);
          else if ([".jpg", ".png", ".jpeg", ".gif"].includes(ext)) result.images.push(fullPath);
          else if ([".exe", ".msi"].includes(ext)) result.installers.push(fullPath);
          else result.others.push(fullPath);
        } catch (e) {}
      });
    } catch (e) {}
  }

  foldersToScan.forEach(folder => walkSync(folder));

  return result;
}

module.exports = { scanFolders };
