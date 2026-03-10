const fs = require("fs");
const path = require("path");
const os = require("os");

function scanFolders(scanFull = false) {
  const home = os.homedir();
  let foldersToScan = {
    Downloads: path.join(home, "Downloads"),
    Desktop: path.join(home, "Desktop"),
    Documents: path.join(home, "Documents"),
    Pictures: path.join(home, "Pictures"),
    Videos: path.join(home, "Videos")
  };

  if (scanFull) {
    // Detect all drives (Windows)
    const drives = ['C:\\', 'D:\\', 'E:\\', 'F:\\', 'G:\\'];
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
                  'system volume information', 'boot'
                ];
                if (!systemFolders.includes(lowerItem) && !item.startsWith('.')) {
                  foldersToScan[`${drive}_${item}`] = fullPath;
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
    desktop: []
  };

  const downloadsPath = path.join(home, "Downloads").toLowerCase();
  const desktopPath = path.join(home, "Desktop").toLowerCase();

  Object.values(foldersToScan).forEach(folder => {
    if (!fs.existsSync(folder)) return;

    try {
      const files = fs.readdirSync(folder);

      files.forEach(file => {
        try {
          const fullPath = path.join(folder, file);
          const stats = fs.lstatSync(fullPath);
          
          if (stats.isDirectory()) return;

          const ext = path.extname(file).toLowerCase();
          const fileObj = {
            name: file,
            path: fullPath,
            size: stats.size,
            date: stats.mtime,
            ext: ext
          };

          result.all.push(fileObj);
          
          if (fullPath.toLowerCase().startsWith(downloadsPath)) result.downloads.push(fileObj);
          if (fullPath.toLowerCase().startsWith(desktopPath)) result.desktop.push(fileObj);

          if (ext === ".pdf") result.pdf.push(fullPath);
          else if ([".jpg", ".png", ".jpeg"].includes(ext)) result.images.push(fullPath);
          else if ([".exe", ".msi"].includes(ext)) result.installers.push(fullPath);
          else result.others.push(fullPath);
        } catch (e) {
          // Skip files that can't be read (permissions etc)
        }
      });
    } catch (e) {
      // Skip folders that can't be read
    }
  });

  return result;
}

module.exports = { scanFolders };
