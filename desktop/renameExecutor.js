const fs = require("fs");
const path = require("path");

function safeExists(p) {
  try { return fs.existsSync(p); } catch { return false; }
}

function applyRenameActions(actions) {
  const done = [];

  for (const a of actions) {
    if (a.type !== "rename") continue;

    // If target already exists, add suffix _1, _2...
    let target = a.to;
    const dir = path.dirname(target);
    const ext = path.extname(target);
    const base = path.basename(target, ext);

    let i = 1;
    while (safeExists(target)) {
      target = path.join(dir, `${base}_${i}${ext}`);
      i++;
    }

    fs.renameSync(a.from, target);

    done.push({
      type: "rename",
      fileType: a.fileType,
      from: a.from,
      to: target
    });
  }

  return done;
}

function undoRenameActions(doneActions) {
  // Undo in reverse order
  const reversed = [...doneActions].reverse();
  for (const a of reversed) {
    if (a.type !== "rename") continue;
    if (safeExists(a.to)) {
      fs.renameSync(a.to, a.from);
    }
  }
}

module.exports = { applyRenameActions, undoRenameActions };
