const path = require("path");

// Make a clean filename from old filename (without extension)
function cleanBaseName(name) {
  // remove extra symbols and multiple spaces
  let s = name
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[(){}\[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // remove common junk words
  s = s.replace(/\b(final|final2|final3|copy|new|latest|v\d+)\b/gi, "").trim();
  s = s.replace(/\s+/g, " ").trim();

  // Title Case (simple)
  s = s
    .split(" ")
    .filter(Boolean)
    .slice(0, 8) // keep it short
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("_");

  if (!s) s = "Document";
  return s;
}

function buildPdfRenamePreview(pdfPaths) {
  const preview = [];

  for (const fullPath of pdfPaths) {
    const dir = path.dirname(fullPath);
    const ext = path.extname(fullPath); // .pdf
    const base = path.basename(fullPath, ext);

    const cleaned = cleanBaseName(base);
    const newPath = path.join(dir, cleaned + ext);

    // Skip if name already same
    if (fullPath === newPath) continue;

    preview.push({
      type: "rename",
      fileType: "pdf",
      from: fullPath,
      to: newPath
    });
  }

  return preview;
}

module.exports = { buildPdfRenamePreview };
