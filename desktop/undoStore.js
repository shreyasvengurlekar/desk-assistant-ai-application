let lastRenameActions = [];

function setLastRenameActions(actions) {
  lastRenameActions = actions;
}

function getLastRenameActions() {
  return lastRenameActions;
}

function clearLastRenameActions() {
  lastRenameActions = [];
}

module.exports = { setLastRenameActions, getLastRenameActions, clearLastRenameActions };
