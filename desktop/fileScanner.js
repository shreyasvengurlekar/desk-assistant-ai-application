const fs = require("fs");
const path = require("path");
const os = require("os");

function scanFolders() {
  const home = os.homedir();

  const folders = {
    Downloads: path.join(home, "Downloads"),
    Desktop: path.join(home, "Desktop")
  };

  const result = {
    pdf: [],
    images: [],
    installers: [],
    others: []
  };

  Object.values(folders).forEach(folder => {
    if (!fs.existsSync(folder)) return;

    const files = fs.readdirSync(folder);

    files.forEach(file => {
      const fullPath = path.join(folder, file);
      if (fs.lstatSync(fullPath).isDirectory()) return;

      const ext = path.extname(file).toLowerCase();

      if (ext === ".pdf") result.pdf.push(fullPath);
      else if ([".jpg", ".png", ".jpeg"].includes(ext)) result.images.push(fullPath);
      else if ([".exe", ".msi"].includes(ext)) result.installers.push(fullPath);
      else result.others.push(fullPath);
    });
  });

  return result;
}

module.exports = { scanFolders };
