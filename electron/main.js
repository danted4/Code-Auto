/**
 * Electron Main Process
 *
 * Creates the app window and loads the Next.js app.
 * Exposes native APIs (e.g. folder picker) via preload.
 */

const { app, BrowserWindow, ipcMain, dialog, nativeImage, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = process.env.NODE_ENV !== 'production';
const PORT = process.env.PORT || 3000;
const URL = isDev ? `http://localhost:${PORT}` : `http://localhost:${PORT}`;

let mainWindow = null;

function getIconPath() {
  const base = path.join(app.getAppPath(), 'public');
  const useDark = nativeTheme.shouldUseDarkColors;
  const dockIcon = useDark ? 'code-auto-dock.png' : 'code-auto-dock-light.png';
  const fallbackIcon = useDark ? 'code-auto-dark.png' : 'code-auto-light.png';
  const dockPath = path.join(base, dockIcon);
  const fallbackPath = path.join(base, fallbackIcon);
  if (fs.existsSync(dockPath)) return dockPath;
  if (fs.existsSync(fallbackPath)) return fallbackPath;
  return path.resolve(__dirname, '..', 'public', fallbackIcon);
}

function createWindow() {
  const iconPath = getIconPath();

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(URL);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Open folder dialog - returns selected path or null if cancelled
ipcMain.handle('open-folder-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow || undefined, {
    properties: ['openDirectory'],
    title: 'Select Project Directory',
  });

  if (result.canceled || !result.filePaths?.length) {
    return null;
  }
  return result.filePaths[0];
});

function setDockIcon() {
  if (process.platform !== 'darwin') return;
  const iconPath = getIconPath();
  const icon = nativeImage.createFromPath(iconPath);
  if (!icon.isEmpty()) {
    app.dock.setIcon(icon);
  }
}

app.whenReady().then(() => {
  app.setName('Code-Auto');
  setDockIcon();
  nativeTheme.on('updated', setDockIcon);
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
