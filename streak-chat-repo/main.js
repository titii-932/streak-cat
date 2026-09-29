const { app, BrowserWindow, ipcMain, Menu, Tray, screen, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const L = require('./logic');

const WIDTH = 362;
let win = null;
let tray = null;
let state = L.defaultState();
let settings = { x: null, y: null, autostart: true };

if (!app.requestSingleInstanceLock()) { app.quit(); }

// ---------- sauvegarde (dossier AppData de l'utilisateur) ----------
const file = name => path.join(app.getPath('userData'), name);
function readJson(name, fallback) {
  try { return { ...fallback, ...JSON.parse(fs.readFileSync(file(name), 'utf8')) }; }
  catch (e) {
    try { if (fs.existsSync(file(name))) fs.copyFileSync(file(name), file(name + '.corrompu')); } catch (_) {}
    return fallback;
  }
}
function writeJson(name, data) {
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    const tmp = file(name + '.tmp');
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, file(name));
  } catch (e) { console.error('Sauvegarde impossible', e); }
}
const saveState = () => writeJson('state.json', state);
const saveSettings = () => writeJson('settings.json', settings);

// ---------- épinglage "sous les fenêtres" (Windows) ----------
let setWindowPos = null;
function pinToBottom() {
  if (process.platform !== 'win32' || !win || win.isDestroyed()) return;
  try {
    if (!setWindowPos) {
      const koffi = require('koffi');
      const user32 = koffi.load('user32.dll');
      setWindowPos = user32.func('bool __stdcall SetWindowPos(intptr_t hWnd, intptr_t hWndInsertAfter, int X, int Y, int cx, int cy, uint32_t uFlags)');
    }
    const hwnd = Number(win.getNativeWindowHandle().readBigUInt64LE(0));
    const HWND_BOTTOM = 1, SWP_NOSIZE = 0x1, SWP_NOMOVE = 0x2, SWP_NOACTIVATE = 0x10;
    setWindowPos(hwnd, HWND_BOTTOM, 0, 0, 0, 0, SWP_NOSIZE | SWP_NOMOVE | SWP_NOACTIVATE);
  } catch (e) { /* pas grave : le widget reste simplement une fenêtre normale */ }
}

// ---------- fenêtre ----------
function defaultPosition(height) {
  const wa = screen.getPrimaryDisplay().workArea;
  return { x: wa.x + wa.width - WIDTH - 20, y: wa.y + wa.height - height - 10 };
}
function isOnScreen(x, y) {
  return screen.getAllDisplays().some(d => {
    const b = d.workArea;
    return x + 60 > b.x && x < b.x + b.width - 60 && y + 60 > b.y && y < b.y + b.height - 60;
  });
}

function createWindow() {
  const height = 660;
  let { x, y } = settings;
  if (x === null || y === null || !isOnScreen(x, y)) ({ x, y } = defaultPosition(height));

  win = new BrowserWindow({
    width: WIDTH, height, x, y,
    frame: false, transparent: true, backgroundColor: '#00000000',
    resizable: false, maximizable: false, minimizable: false, fullscreenable: false,
    hasShadow: false, skipTaskbar: true,
    focusable: false,               // un clic sur le widget ne le remonte pas au-dessus de tes fenêtres
    show: false,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: true },
  });
  win.setMenu(null);
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => { win.showInactive(); pinToBottom(); });
  win.on('show', pinToBottom);

  let t;
  win.on('move', () => { clearTimeout(t); t = setTimeout(() => { const [px, py] = win.getPosition(); settings.x = px; settings.y = py; saveSettings(); }, 400); });
  win.on('closed', () => { win = null; });
}

// ---------- état -> fenêtre ----------
function currentView() {
  const v = L.view(state, new Date());
  saveState();
  return v;
}
function push() { if (win && !win.isDestroyed()) win.webContents.send('state:update', currentView()); }

// ---------- menu (clic sur ⋯, clic droit ou icône près de l'horloge) ----------
function buildMenu() {
  return Menu.buildFromTemplate([
    { label: 'Lancer avec Windows', type: 'checkbox', checked: settings.autostart !== false, enabled: app.isPackaged, click: item => { settings.autostart = item.checked; saveSettings(); applyAutostart(); } },
    { label: 'Remettre à sa place d\'origine', click: () => { if (win) { const [, h] = win.getSize(); const p = defaultPosition(h); win.setPosition(p.x, p.y); } } },
    { type: 'separator' },
    { label: 'Quitter le widget', click: () => app.quit() },
  ]);
}
function applyAutostart() {
  if (!app.isPackaged) return; // en mode développement on ne touche pas au démarrage de Windows
  app.setLoginItemSettings({ openAtLogin: settings.autostart !== false, path: process.execPath, args: [] });
}

// ---------- démarrage ----------
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  state = readJson('state.json', L.defaultState());
  settings = readJson('settings.json', settings);
  applyAutostart();
  createWindow();

  try {
    const img = nativeImage.createFromPath(path.join(__dirname, 'icon.png')).resize({ width: 16, height: 16 });
    tray = new Tray(img);
    tray.setToolTip('Ma streak');
    tray.setContextMenu(buildMenu());
  } catch (e) {}

  ipcMain.handle('state:get', () => currentView());
  ipcMain.handle('state:press', () => {
    const ok = L.press(state, new Date());
    saveState();
    return { ok, view: L.view(state, new Date()) };
  });
  ipcMain.on('win:resize', (_e, h) => {
    if (!win || win.isDestroyed()) return;
    const height = Math.max(300, Math.min(1000, Math.round(h)));
    const [, cur] = win.getSize();
    if (height === cur) return;
    const bounds = win.getBounds();
    const bottomKept = settings.x === null; // 1er lancement : on garde le bas près du bord de l'écran
    win.setBounds({ x: bounds.x, y: bottomKept ? bounds.y + (cur - height) : bounds.y, width: WIDTH, height });
    pinToBottom();
  });
  ipcMain.on('win:menu', () => { if (win) buildMenu().popup({ window: win }); });

  // minuit, changement d'heure de la journée (endormi -> inquiet à 17h), réveil du PC...
  setInterval(push, 30 * 1000);
  setInterval(pinToBottom, 4000);
  screen.on('display-metrics-changed', () => { if (win && !isOnScreen(...win.getPosition())) { const p = defaultPosition(win.getSize()[1]); win.setPosition(p.x, p.y); } });
});

app.on('second-instance', () => { if (win) { win.showInactive(); pinToBottom(); } });
app.on('window-all-closed', () => app.quit());
