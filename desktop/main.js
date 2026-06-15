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

  // Blank CSVs (headers only) for files that must be empty on fresh install.
  const BLANK_CSVS = {
    'sender_accounts.csv':   'sender_email,display_name,profile_dir,enabled\n',
    'schedule_tracker.csv':  'queue_id,sender_email,recipient_email,subject,template_key,scheduled_at,category,company_name,website,day_name,per_sender_sequence,notes\n',
    'scheduled_results.csv': 'queue_id,sender_email,recipient_email,subject,scheduled_at,status,scheduled_native_at,created_at,notes\n',
    'failed_results.csv':    'queue_id,sender_email,recipient_email,subject,scheduled_at,error_code,error_message,failed_at,screenshot_path\n',
  };

  // Pre-seeded CSVs: written on fresh install OR when file exists but has no data rows.
  const SEEDED_CSVS = {
    'templates.csv': [
      'template_key,body',
      'T1,"hello- thinking of doing reddit commenting?\n\nit will show up on llms.\n\ni do provide 100 comments + 4 posts/mo on reddit.\n\nbeen doing this for b2b/b2c saas/retail.\n\nshould i send you case studies?"',
      'T2,"hello- thinking of doing reddit comment?\n\nit will show up on llms and google ai overviews.\n\ni do provide 100 comments + 4 posts/mo on reddit.\n\nbeen doing this for yc/techstars b2b/b2c/d2c.\n\nshould i send you case studies?"',
      'T3,"hey- thinking of doing reddit commenting?\n\nit will show up on ai search engines.\n\ni do provide 100 comments + 4 posts/mo on reddit.\n\nbeen doing this for yc/techstars b2b/b2c/d2c.\n\ncan i send you examples?"',
      'T4,"tried any reddit commenting/posting?\n\nchatgpt/perplexity/gemini getting 67%+ of their answers from reddit.\n\nso commenting on relevant subreddits will bring user signups, traffic, leads (make you visible on both LLMs/Google).\n\ni\'d suggest doing 100 comments + 4 post / mo (mentioning your brand).\n\nbeen doing this for b2b/b2c/d2c brands incl. techstars and yc startups.\n\nSearch up ""getredditor dot com"" to see how it works."',
      'T5,"people now ask things on llm.\n\ni\'d think about doing some ai search visibility stuff like reddit commenting/posting.\n\nsee ""getredditor"" if you\'re keen."',
    ].join('\n') + '\n',
    'subject_pool.csv': [
      'subject_id,subject',
      'S1,your commentator',
      'S2,jump the gun',
      'S3,social seo',
      'S4,reddit at your fingertips',
      'S5,reddit for seo',
      'S6,rolling in reddit',
      'S7,organic reddit',
      'S8,small growth idea',
      'S9,commenting on reddit',
      'S10,visibility beyond google',
      'S11,reddit comments',
      'S12,where buyers ask',
      'S13,reddit loop',
      'S14,your footprint',
      'S15,seen on reddit',
      'S16,reddit as proof',
      'S17,reddit-led gen',
      'S18,words on reddit',
      'S19,found you on reddit',
      'S20,all hands on deck',
      'S21,easy does it',
      'S22,reddit fast track',
    ].join('\n') + '\n',
  };

  if (!fs.existsSync(dirs.DATA_DIR)) {
    fs.mkdirSync(dirs.DATA_DIR, { recursive: true });
    for (const [file, content] of Object.entries(BLANK_CSVS)) {
      fs.writeFileSync(path.join(dirs.DATA_DIR, file), content, 'utf8');
    }
    for (const [file, content] of Object.entries(SEEDED_CSVS)) {
      fs.writeFileSync(path.join(dirs.DATA_DIR, file), content, 'utf8');
    }
  } else {
    // Ensure missing files are created; seed templates/subjects if they have no data rows.
    for (const [file, content] of Object.entries(BLANK_CSVS)) {
      const p = path.join(dirs.DATA_DIR, file);
      if (!fs.existsSync(p)) fs.writeFileSync(p, content, 'utf8');
    }
    for (const [file, content] of Object.entries(SEEDED_CSVS)) {
      const p = path.join(dirs.DATA_DIR, file);
      if (!fs.existsSync(p)) {
        fs.writeFileSync(p, content, 'utf8');
      } else {
        // Seed if file only has the header line (no data rows yet)
        const existing = fs.readFileSync(p, 'utf8').trim();
        const lines = existing.split('\n').filter(l => l.trim());
        if (lines.length <= 1) fs.writeFileSync(p, content, 'utf8');
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
let splashShownAt = 0;
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
  // Look for icon.png in several locations (packaged vs dev)
  const candidates = [
    path.join(__dirname, 'icon.png'),
    path.join(__dirname, 'icon.ico'),
    app.isPackaged ? path.join(process.resourcesPath, 'icon.png') : null,
  ].filter(Boolean);

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const img = nativeImage.createFromPath(p);
      if (!img.isEmpty()) return img;
    }
  }

  // Fallback: embedded 32x32 blue mail icon (base64 PNG)
  return nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAA7EAAAOxAGVKw4bAAABnklEQVRYhe2XMU7DMBSGv7cMoGzpyg' +
    'EYkDogMSAxcgAOwMoJKi6AkDgAA2Ko2JC6deoB2LoDC6JDJdKhqZ3YiRMnLUL6pFSx4/f5t19sWVJKiT8kAID/ThAR/A4RkSmlVErpUkoppVJKqXsA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
  ).resize({ width: 32, height: 32 });
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
  splashShownAt = Date.now();
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
    // Keep splash visible for at least 2.5 s so the animation is seen.
    const MIN_SPLASH_MS = 2500;
    const delay = Math.max(0, MIN_SPLASH_MS - (Date.now() - splashShownAt));
    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
        splashWindow = null;
      }
      mainWindow.show();
      mainWindow.focus();
    }, delay);
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
