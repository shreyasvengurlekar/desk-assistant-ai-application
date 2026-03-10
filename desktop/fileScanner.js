const fs = require("fs");
const path = require("path");
const os = require("os");

function scanFolders() {
  const home = os.homedir();

  const folders = {
    Downloads: path.join(home, "Downloads"),
    Desktop: path.join(home, "Desktop"),
    Documents: path.join(home, "Documents"),
    Pictures: path.join(home, "Pictures"),
    Videos: path.join(home, "Videos")
  };

  const result = {
    pdf: [],
    images: [],
    installers: [],
    others: [],
    all: [] // New field to hold all file objects
  };

  Object.values(folders).forEach(folder => {
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
