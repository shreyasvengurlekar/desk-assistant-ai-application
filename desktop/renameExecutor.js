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
    if (a.type === "delete") {
      // Deletion is permanent in terms of undo via this tool (Recycle Bin logic).
      // We inform the user they need to restore it from the bin.
      continue;
    }

    if (a.type !== "rename") continue;
    if (safeExists(a.to)) {
      try {
        fs.renameSync(a.to, a.from);
      } catch (e) {
        if (e.code === 'EXDEV') {
          fs.copyFileSync(a.to, a.from);
          fs.unlinkSync(a.to);
        } else {
          console.error(`Undo failed for ${a.to}:`, e);
        }
      }
    }
  }
}

module.exports = { applyRenameActions, undoRenameActions };
