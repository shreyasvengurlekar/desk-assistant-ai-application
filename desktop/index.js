const { app, BrowserWindow, Tray, Menu } = require('electron');
const path = require('path');

let mainWindow;
let tray;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    show: false, // 👈 IMPORTANT
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Hide instead of close
  mainWindow.on('close', (event) => {
    event.preventDefault();
    mainWindow.hide();
  });
}

app.whenReady().then(() => {
  createWindow();

  // Tray icon
  tray = new Tray(path.join(__dirname, 'assets', 'icon.png'));

  const trayMenu = Menu.buildFromTemplate([
    {
      label: 'Open Desk Assistant AI',
      click: () => {
        mainWindow.show();
      }
    },
    {
      label: 'Quit',
      click: () => {
        app.exit();
      }
    }
  ]);

  tray.setToolTip('Desk Assistant AI');
  tray.setContextMenu(trayMenu);

  tray.on('click', () => {
    mainWindow.show();
  });
});
