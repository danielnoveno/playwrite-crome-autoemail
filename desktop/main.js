// ---------------------------------------------------------------------------
// Gmail Scheduler — Electron Desktop App (Main Process)
// ---------------------------------------------------------------------------
// Starts the Express backend in the main process, waits for it to be ready,
// then opens the dashboard in a native Electron window with system-tray
// support. Closing the window minimises to tray; right-click tray to quit.
// ---------------------------------------------------------------------------

const { app, BrowserWindow, Tray, Menu, shell, nativeImage, dialog } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const ROOT = path.resolve(__dirname, '..');
const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}`;
const SPLASH_PATH = path.join(__dirname, 'splash.html');
const APP_NAME = 'Gmail Scheduler';

// ---------------------------------------------------------------------------
// Writable runtime directories.
//   - Dev: everything lives in the project folder (./data, ./profiles, …).
//   - Packaged: app.asar is read-only, so CSVs / Chrome profiles / logs go
//     into the per-user app-data folder. Seed data shipped in resources/data
//     is copied there on first run.
// These paths are passed to server.js via env; config.js already honours them.
// ---------------------------------------------------------------------------
function resolveRuntimeDirs() {
  if (!app.isPackaged) {
    return {
      DATA_DIR: path.join(ROOT, 'data'),
      PROFILES_DIR: path.join(ROOT, 'profiles'),
      SCREENSHOT_DIR: path.join(ROOT, 'screenshots'),
      LOGS_DIR: path.join(ROOT, 'logs'),
    };
  }
  const base = app.getPath('userData');
  const dirs = {
    DATA_DIR: path.join(base, 'data'),
    PROFILES_DIR: path.join(base, 'profiles'),
    SCREENSHOT_DIR: path.join(base, 'screenshots'),
    LOGS_DIR: path.join(base, 'logs'),
  };

  // First-run seed: copy bundled CSVs into the writable data dir.
  // The bundled data lives in resources/data (electron-builder extraResources)
  // or in the app folder's own data dir (@electron/packager) — try both.
  if (!fs.existsSync(dirs.DATA_DIR)) {
    fs.mkdirSync(dirs.DATA_DIR, { recursive: true });
    const seedCandidates = [
      path.join(process.resourcesPath, 'data'),
      path.join(ROOT, 'data'),
    ];
    const seedDir = seedCandidates.find(d => fs.existsSync(d));
    if (seedDir) {
      for (const file of fs.readdirSync(seedDir)) {
        try { fs.copyFileSync(path.join(seedDir, file), path.join(dirs.DATA_DIR, file)); }
        catch (_) { /* skip directories / locked files */ }
      }
    }
  }
  for (const dir of Object.values(dirs)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dirs;
}

const RUNTIME_DIRS = resolveRuntimeDirs();

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let mainWindow = null;
let splashWindow = null;
let tray = null;
let isQuitting = false;

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  dialog.showErrorBox(APP_NAME, 'Aplikasi sudah berjalan. Cek system tray (pojok kanan bawah).');
  app.quit();
}

app.on('second-instance', () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
});

// ---------------------------------------------------------------------------
// Tray icon — small inline 16×16 blue/white mail-envelope PNG (base64).
// This avoids requiring an external .ico file and works on all platforms.
// ---------------------------------------------------------------------------
function buildTrayIcon() {
  // Simple 16x16 colored icon (blue gradient square)
  // If a custom icon exists, prefer that.
  const customIconPath = path.join(__dirname, 'icon.png');
  if (fs.existsSync(customIconPath)) {
    return nativeImage.createFromPath(customIconPath);
  }
  const icoPath = path.join(__dirname, 'icon.ico');
  if (fs.existsSync(icoPath)) {
    return nativeImage.createFromPath(icoPath);
  }
  // Fallback: 16x16 blue square via data URL
  return nativeImage
    .createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/' +
      '9hAAAAAXNSR0IArs4c6QAAAGRJREFUOBFjYBgFgz4AGBkZ/zMyMDAyMTExMDMzM7Cw' +
      'sDCwsrIysLGxMbCzszNwcHAwcHJyMnBxcTFwc3Mz8PDwMPDy8jLw8fEx8PPzMwgICD' +
      'AICgoyCAsLM4iIiDCIiooyjIZ0AAC2Og5BuoU+hgAAAABJRU5ErkJggg=='
    )
    .resize({ width: 16, height: 16 });
}

// ---------------------------------------------------------------------------
// Splash screen — shown while the Express server is booting
// ---------------------------------------------------------------------------
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 520,
    height: 400,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  splashWindow.loadFile(SPLASH_PATH);
  splashWindow.center();
}

// ---------------------------------------------------------------------------
// Main application window
// ---------------------------------------------------------------------------
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 960,
    minHeight: 640,
    title: APP_NAME,
    icon: buildTrayIcon(),
    backgroundColor: '#0f0f14',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadURL(BASE_URL);

  mainWindow.once('ready-to-show', () => {
    // Close splash and reveal main window
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow.show();
    mainWindow.focus();
  });

  // Minimise to tray instead of closing
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  // Open external links (mailto, https, etc.) in the default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http') || url.startsWith('mailto')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
}

// ---------------------------------------------------------------------------
// System tray
// ---------------------------------------------------------------------------
function createTray() {
  tray = new Tray(buildTrayIcon());

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '📂  Buka Dashboard',
      click: () => {
        if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
      },
    },
    {
      label: '🌐  Buka di Browser',
      click: () => shell.openExternal(BASE_URL),
    },
    { type: 'separator' },
    {
      label: '🔄  Reload Dashboard',
      click: () => {
        if (mainWindow) mainWindow.reload();
      },
    },
    {
      label: '🛠  Buka DevTools',
      click: () => {
        if (mainWindow) mainWindow.webContents.openDevTools();
      },
    },
    { type: 'separator' },
    {
      label: '❌  Keluar',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip(`${APP_NAME} — berjalan di port ${PORT}`);
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
  });
}

// ---------------------------------------------------------------------------
// Express server lifecycle
// ---------------------------------------------------------------------------
function startServer() {
  return new Promise((resolve, reject) => {
    console.log('[desktop] Starting Express server …');

    try {
      Object.assign(process.env, {
        PORT: String(PORT),
        ELECTRON: '1',
        RESOURCES_PATH: process.resourcesPath,
        ...RUNTIME_DIRS,
      });
      require(path.join(ROOT, 'server.js'));
    } catch (err) {
      reject(new Error(`Gagal menjalankan server: ${err.message}`));
      return;
    }

    // Poll /api/health until the server is ready
    let attempts = 0;
    const maxAttempts = 120; // 60 seconds (120 × 500 ms)
    const timer = setInterval(() => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(timer);
        reject(new Error('Server tidak merespons dalam 60 detik.'));
        return;
      }

      const req = http.get(`${BASE_URL}/api/health`, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          if (res.statusCode === 200) {
            clearInterval(timer);
            console.log(`[desktop] Server ready on port ${PORT}`);
            resolve();
          }
        });
      });
      req.on('error', () => {}); // server still starting — ignore
      req.setTimeout(400, () => req.destroy());
    }, 500);
  });
}

function stopServer() {
  // The API now runs in-process with Electron, so there is no child server
  // to terminate here.
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
app.whenReady().then(async () => {
  createSplashWindow();

  try {
    await startServer();
  } catch (err) {
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
    dialog.showErrorBox(APP_NAME, `Gagal menjalankan server:\n${err.message}`);
    app.quit();
    return;
  }

  createMainWindow();
  createTray();
});

app.on('before-quit', () => {
  isQuitting = true;
  stopServer();
});

app.on('window-all-closed', () => {
  // On macOS apps stay open until Cmd+Q; on Windows/Linux we keep running
  // in the tray. Only quit if the user explicitly chose "Keluar".
  if (isQuitting) app.quit();
});

app.on('activate', () => {
  // macOS dock click
  if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
});
