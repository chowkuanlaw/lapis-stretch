'use strict';
/*
 * Lapis — stretch reminder for Windows.
 * The main process owns the timer and all state, so reminders keep firing
 * even when every window is hidden. Windows only render what they are sent.
 *   main window : dashboard, settings, stretch library (closing hides it to the tray)
 *   widget      : small always-on-top countdown card on the desktop
 *   popup       : the reminder card that slides up in the bottom-right corner
 */
const { app, BrowserWindow, Tray, Menu, ipcMain, screen, Notification, nativeImage, nativeTheme, shell, powerMonitor, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { CYCLE, BY } = require('./renderer/data.js');

const AUMID = 'app.lapis.stretch';
const AWAY_SECS = 300;          // 5 min without keyboard/mouse = away from desk
const POPUP_W = 440, WIDGET_W = 300, WIDGET_H = 100;
const ICON = path.join(__dirname, 'assets', 'icon.png');
const TRAY_ICON = path.join(__dirname, 'assets', process.platform === 'win32' ? 'tray.ico' : 'tray.png');
// Update check (off unless the user turns it on): the only network request Lapis can make.
const REPO = 'chowkuanlaw/lapis-stretch';
const RELEASES_URL = `https://github.com/${REPO}/releases/latest`;
const LATEST_API = `https://api.github.com/repos/${REPO}/releases/latest`;
const UPDATE_EVERY = 24 * 3600e3;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  run();
}

function run() {
  app.setAppUserModelId(AUMID);
  Menu.setApplicationMenu(null);

  /* ---------- state ---------- */
  const DEFAULTS = {
    interval: 20, snooze: 10, sound: true, toast: false, widget: true, widgetOnTop: true,
    autostart: true, awayReset: true, paused: false, pausedLeft: 0, nextDue: 0, idx: 0,
    history: {}, widgetPos: null, firstRun: true, updateCheck: false, lastUpdateCheck: 0
  };
  const stateFile = () => path.join(app.getPath('userData'), 'state.json');
  let S = Object.assign({}, DEFAULTS);
  const R = { mode: 'waiting', cur: null, activeEnd: 0, activeSecs: 0, switched: false, dueAt: 0, rechimes: 0, msgUntil: 0, awaySince: null, update: null, updateMsg: '', checking: false };

  let mainWin = null, widgetWin = null, popupWin = null, tray = null, quitting = false;
  let popupH = 230, saveTimer = null, lastDay = dayKey(new Date());

  function loadState() {
    try { S = Object.assign({}, DEFAULTS, JSON.parse(fs.readFileSync(stateFile(), 'utf8'))); } catch (e) { S = Object.assign({}, DEFAULTS); }
    // A fresh launch (e.g. first thing in the morning) starts a new countdown instead of firing at once.
    if (S.paused) S.pausedLeft = Math.max(S.pausedLeft || 0, 0);
    S.nextDue = Date.now() + S.interval * 60e3;
  }
  function writeNow() { try { fs.writeFileSync(stateFile(), JSON.stringify(S)); } catch (e) { /* best effort */ } }
  function save() { clearTimeout(saveTimer); saveTimer = setTimeout(writeNow, 300); }

  function pad(n) { return String(n).padStart(2, '0'); }
  function dayKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function mmss(ms) { const t = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(t / 60)}:${pad(t % 60)}`; }
  function today() { const k = dayKey(new Date()); return S.history[k] || (S.history[k] = { total: 0, by: {} }); }
  function upNext() { return BY[CYCLE[S.idx % CYCLE.length]]; }

  function publicState() {
    const { widgetPos, firstRun, lastUpdateCheck, ...rest } = S;
    return Object.assign(rest, {
      mode: R.mode, cur: R.cur, upNext: upNext().id, activeEnd: R.activeEnd, activeSecs: R.activeSecs,
      switched: R.switched, away: !!R.awaySince,
      version: app.getVersion(), update: R.update, updateMsg: R.updateMsg, checking: R.checking
    });
  }
  function broadcast() {
    const st = publicState();
    for (const w of [mainWin, widgetWin, popupWin]) if (w && !w.isDestroyed()) w.webContents.send('state', st);
    syncPopup();
    updateTray();
  }

  /* ---------- reminder flow ---------- */
  function chime(kind) {
    if (S.sound && popupWin && !popupWin.isDestroyed()) popupWin.webContents.send('chime', kind);
  }
  function toast(ex) {
    if (!S.toast || !Notification.isSupported()) return;
    const n = new Notification({ title: "It's time to stretch!", body: `${ex.name} · ${ex.dose}`, icon: ICON, silent: true });
    n.on('click', () => { positionPopup(); popupWin.showInactive(); });
    n.show();
  }
  function becomeDue(exId, quiet) {
    R.cur = exId && BY[exId] ? exId : upNext().id;
    R.mode = 'due'; R.dueAt = Date.now(); R.rechimes = 0;
    if (!quiet) { chime('due'); toast(BY[R.cur]); }
    broadcast();
  }
  function start() {
    const ex = BY[R.cur || upNext().id];
    R.cur = ex.id; R.mode = 'active'; R.activeSecs = ex.secs; R.activeEnd = Date.now() + ex.secs * 1000; R.switched = false;
    broadcast();
  }
  function schedule(ms) { S.nextDue = Date.now() + ms; if (S.paused) S.pausedLeft = ms; save(); }
  function advance() { if (R.cur === upNext().id) S.idx++; }
  function finish() {
    const t = today(); t.total++; t.by[R.cur] = (t.by[R.cur] || 0) + 1;
    advance(); schedule(S.interval * 60e3); chime('done');
    R.mode = 'done'; R.msgUntil = Date.now() + 5000;
    broadcast();
  }
  function skip() { advance(); schedule(S.interval * 60e3); R.mode = 'waiting'; R.cur = null; broadcast(); }
  function snooze() { schedule(S.snooze * 60e3); R.mode = 'snoozed'; R.msgUntil = Date.now() + 3500; broadcast(); }
  function different() {
    const base = R.cur || upNext().id; let i = S.idx;
    do { i++; } while (CYCLE[i % CYCLE.length] === base);
    S.idx = i; save();
    if (R.mode === 'due') R.cur = upNext().id;
    broadcast();
  }
  function togglePause() {
    if (S.paused) { S.paused = false; S.nextDue = Date.now() + Math.max(S.pausedLeft, 1000); }
    else {
      S.paused = true; S.pausedLeft = Math.max(0, S.nextDue - Date.now());
      if (R.mode !== 'active') { R.mode = 'waiting'; R.cur = null; }
    }
    save(); broadcast();
  }
  function restartCountdown() {
    if (R.mode === 'waiting' && !S.paused) { R.awaySince = null; schedule(S.interval * 60e3); broadcast(); }
  }

  /* ---------- update check ---------- */
  function isNewer(a, b) {
    const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
    return false;
  }
  async function checkForUpdate(manual) {
    if (R.checking) return;
    R.checking = true; if (manual) R.updateMsg = 'Checking...';
    broadcast();
    try {
      // Plain public request: no account, no identifiers, nothing about your stretches.
      const res = await net.fetch(LATEST_API, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Lapis' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const tag = String((await res.json()).tag_name || '');
      const m = /^v?(\d+\.\d+\.\d+)$/.exec(tag);
      if (m && isNewer(m[1], app.getVersion())) { R.update = { version: m[1] }; R.updateMsg = `Lapis ${m[1]} is available`; }
      else { R.update = null; R.updateMsg = `You have the latest version`; }
    } catch (e) {
      if (manual) R.updateMsg = "Couldn't reach GitHub. Check your connection and try again.";
    }
    R.checking = false; S.lastUpdateCheck = Date.now(); save(); broadcast();
  }
  function openReleases() { shell.openExternal(RELEASES_URL); }

  function setSetting(key, value) {
    switch (key) {
      case 'interval': S.interval = [15, 20, 30, 45, 60].includes(+value) ? +value : 20; if (R.mode === 'waiting') schedule(S.interval * 60e3); break;
      case 'snooze': S.snooze = [5, 10, 15].includes(+value) ? +value : 10; break;
      case 'sound': case 'toast': case 'awayReset': S[key] = !!value; break;
      case 'widget': S.widget = !!value; syncWidget(); break;
      case 'widgetOnTop': S.widgetOnTop = !!value; if (widgetWin) widgetWin.setAlwaysOnTop(S.widgetOnTop, 'floating'); break;
      case 'autostart': S.autostart = !!value; applyAutostart(); break;
      case 'updateCheck':
        S.updateCheck = !!value;
        if (S.updateCheck) setTimeout(() => checkForUpdate(false), 0);
        else { R.update = null; R.updateMsg = ''; }
        break;
      default: return;
    }
    save(); broadcast();
  }

  function tick() {
    const now = Date.now();
    if (S.awayReset && R.mode === 'waiting' && !S.paused) {
      let idle = 0; try { idle = powerMonitor.getSystemIdleTime(); } catch (e) { /* ignore */ }
      if (idle >= AWAY_SECS) { if (!R.awaySince) { R.awaySince = now - idle * 1000; broadcast(); } }
      else if (R.awaySince) { R.awaySince = null; schedule(S.interval * 60e3); broadcast(); }
    } else if (R.awaySince) { R.awaySince = null; broadcast(); }

    if (R.mode === 'waiting' && !S.paused && !R.awaySince && now >= S.nextDue) becomeDue();
    else if (R.mode === 'due' && now - R.dueAt > (R.rechimes + 1) * 5 * 60e3) { R.rechimes++; chime('due'); }
    else if (R.mode === 'active') {
      const left = R.activeEnd - now, ex = BY[R.cur];
      if (ex.sides && !R.switched && left <= R.activeSecs * 500) { R.switched = true; chime('switch'); broadcast(); }
      if (left <= 0) finish();
    } else if ((R.mode === 'done' || R.mode === 'snoozed') && now >= R.msgUntil) { R.mode = 'waiting'; R.cur = null; broadcast(); }

    const dk = dayKey(new Date());
    if (dk !== lastDay) { lastDay = dk; broadcast(); }
    if (S.updateCheck && !R.checking && now - (S.lastUpdateCheck || 0) > UPDATE_EVERY) checkForUpdate(false);
    if (tray) tray.setToolTip(`Lapis · ${statusLabel()}`);
  }

  /* ---------- windows ---------- */
  const bg = () => (nativeTheme.shouldUseDarkColors ? '#0F1612' : '#F2F5EE');
  function webPrefs(extra) {
    return Object.assign({
      preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false,
      autoplayPolicy: 'no-user-gesture-required', spellcheck: false
    }, extra || {});
  }
  function lockDown(win) {
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', e => e.preventDefault());
  }
  function loadView(win, view) { win.loadFile(path.join(__dirname, 'renderer', 'index.html'), { query: { view } }); }

  function createMain(show) {
    mainWin = new BrowserWindow({
      width: 1060, height: 800, minWidth: 380, minHeight: 500, show: false, title: 'Lapis',
      icon: ICON, backgroundColor: bg(), autoHideMenuBar: true, webPreferences: webPrefs()
    });
    lockDown(mainWin);
    loadView(mainWin, 'main');
    mainWin.once('ready-to-show', () => { if (show) mainWin.show(); });
    mainWin.on('close', e => { if (!quitting) { e.preventDefault(); mainWin.hide(); } });
  }
  function showMain() {
    if (!mainWin || mainWin.isDestroyed()) createMain(true);
    if (mainWin.isMinimized()) mainWin.restore();
    mainWin.show(); mainWin.focus();
  }

  function onSomeDisplay(p) {
    return p && screen.getAllDisplays().some(d => {
      const a = d.workArea;
      return p.x >= a.x - 40 && p.y >= a.y - 20 && p.x + 80 <= a.x + a.width + WIDGET_W && p.y + 40 <= a.y + a.height + WIDGET_H;
    });
  }
  function createWidget() {
    const wa = screen.getPrimaryDisplay().workArea;
    const pos = onSomeDisplay(S.widgetPos) ? S.widgetPos : { x: wa.x + wa.width - WIDGET_W - 12, y: wa.y + 12 };
    widgetWin = new BrowserWindow({
      x: pos.x, y: pos.y, width: WIDGET_W, height: WIDGET_H, frame: false, transparent: true, resizable: false,
      maximizable: false, minimizable: false, fullscreenable: false, skipTaskbar: true, hasShadow: false,
      alwaysOnTop: S.widgetOnTop, show: false, title: 'Lapis widget', icon: ICON, webPreferences: webPrefs()
    });
    if (S.widgetOnTop) widgetWin.setAlwaysOnTop(true, 'floating');
    lockDown(widgetWin);
    loadView(widgetWin, 'widget');
    widgetWin.once('ready-to-show', () => { if (S.widget) widgetWin.showInactive(); });
    let moveT;
    widgetWin.on('move', () => {
      clearTimeout(moveT);
      moveT = setTimeout(() => { if (widgetWin && !widgetWin.isDestroyed()) { const [x, y] = widgetWin.getPosition(); S.widgetPos = { x, y }; save(); } }, 400);
    });
    widgetWin.on('close', e => { if (!quitting) { e.preventDefault(); setSetting('widget', false); } });
  }
  function syncWidget() {
    if (!widgetWin || widgetWin.isDestroyed()) return;
    if (S.widget && !widgetWin.isVisible()) widgetWin.showInactive();
    if (!S.widget && widgetWin.isVisible()) widgetWin.hide();
  }

  function createPopup() {
    popupWin = new BrowserWindow({
      width: POPUP_W, height: popupH, frame: false, transparent: true, resizable: false, maximizable: false,
      minimizable: false, fullscreenable: false, skipTaskbar: true, hasShadow: false, alwaysOnTop: true,
      show: false, focusable: true, title: 'Lapis reminder', icon: ICON,
      webPreferences: webPrefs({ backgroundThrottling: false })
    });
    popupWin.setAlwaysOnTop(true, 'pop-up-menu');
    lockDown(popupWin);
    loadView(popupWin, 'popup');
    popupWin.on('close', e => { if (!quitting) { e.preventDefault(); popupWin.hide(); } });
  }
  function positionPopup() {
    const d = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
    popupWin.setBounds({ x: d.x + d.width - POPUP_W - 8, y: d.y + d.height - popupH - 8, width: POPUP_W, height: popupH });
  }
  function syncPopup() {
    if (!popupWin || popupWin.isDestroyed()) return;
    const want = R.mode !== 'waiting';
    if (want && !popupWin.isVisible()) { positionPopup(); popupWin.showInactive(); popupWin.setAlwaysOnTop(true, 'pop-up-menu'); }
    else if (!want && popupWin.isVisible()) popupWin.hide();
  }

  /* ---------- tray ---------- */
  function statusLabel() {
    const ex = BY[R.cur || upNext().id];
    if (R.mode === 'due') return 'Time to stretch!';
    if (R.mode === 'active') return `Stretching: ${ex.name}`;
    if (R.mode === 'done') return 'Nice, stretch done';
    if (S.paused) return 'Paused';
    if (R.awaySince) return 'Away from desk';
    return `Next stretch in ${mmss(S.nextDue - Date.now())}`;
  }
  function buildMenu() {
    const updateItems = R.update ? [{ label: `Download Lapis ${R.update.version}`, click: openReleases }, { type: 'separator' }] : [];
    return Menu.buildFromTemplate([
      ...updateItems,
      { label: statusLabel(), enabled: false },
      { label: `${today().total} stretches today`, enabled: false },
      { type: 'separator' },
      { label: 'Stretch now', click: () => becomeDue(null, true) },
      { label: S.paused ? 'Resume reminders' : 'Pause reminders', click: togglePause },
      { type: 'separator' },
      { label: 'Open Lapis', click: showMain },
      { label: 'Show desktop widget', type: 'checkbox', checked: S.widget, click: m => setSetting('widget', m.checked) },
      { label: 'Start with Windows', type: 'checkbox', checked: S.autostart, click: m => setSetting('autostart', m.checked) },
      { type: 'separator' },
      { label: 'Quit Lapis', click: () => { quitting = true; app.quit(); } }
    ]);
  }
  function createTray() {
    let img = nativeImage.createFromPath(TRAY_ICON);
    if (img.isEmpty()) img = nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 });
    tray = new Tray(img);
    tray.setToolTip('Lapis');
    tray.on('click', () => { if (mainWin && mainWin.isVisible() && mainWin.isFocused()) mainWin.hide(); else showMain(); });
    tray.on('right-click', () => tray.popUpContextMenu(buildMenu()));
  }
  function updateTray() { if (tray) tray.setToolTip(`Lapis · ${statusLabel()}`); }

  /* ---------- Windows integration ---------- */
  function applyAutostart() {
    if (!app.isPackaged) return;
    try { app.setLoginItemSettings({ openAtLogin: S.autostart, path: process.execPath, args: ['--hidden'] }); } catch (e) { /* ignore */ }
  }
  function ensureStartMenuShortcut() {
    // A Start Menu shortcut carrying the AppUserModelID is what lets Windows show toast notifications.
    if (process.platform !== 'win32' || !app.isPackaged) return;
    try {
      const lnk = path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Lapis.lnk');
      shell.writeShortcutLink(lnk, fs.existsSync(lnk) ? 'replace' : 'create', {
        target: process.execPath, args: '', description: 'Lapis stretch reminder', icon: process.execPath, iconIndex: 0, appUserModelId: AUMID
      });
    } catch (e) { /* ignore */ }
  }

  /* ---------- IPC ---------- */
  ipcMain.handle('get-state', () => publicState());
  ipcMain.on('action', (_e, a) => {
    if (!a || typeof a.type !== 'string') return;
    switch (a.type) {
      case 'now': becomeDue(a.ex, true); break;
      case 'start': if (R.mode === 'due' || R.mode === 'waiting') start(); break;
      case 'snooze': if (R.mode === 'due') snooze(); break;
      case 'done': if (R.mode === 'active') finish(); break;
      case 'stop': case 'skip': if (R.mode === 'active' || R.mode === 'due') skip(); break;
      case 'different': different(); break;
      case 'pause': togglePause(); break;
      case 'set': setSetting(a.key, a.value); break;
      case 'open-main': showMain(); break;
      case 'popup-size': {
        const h = Math.max(120, Math.min(560, Math.round(+a.h || 0)));
        if (h !== popupH) { popupH = h; if (popupWin && popupWin.isVisible()) positionPopup(); else if (popupWin) popupWin.setSize(POPUP_W, popupH); }
        break;
      }
      case 'test-chime': chime('due'); break;
      case 'check-update': checkForUpdate(true); break;
      case 'open-release': openReleases(); break;
      default: break;
    }
  });

  /* ---------- lifecycle ---------- */
  app.on('second-instance', showMain);
  app.on('window-all-closed', () => { /* keep running in the tray */ });
  app.on('before-quit', () => { quitting = true; clearTimeout(saveTimer); writeNow(); });

  app.whenReady().then(() => {
    loadState();
    const startHidden = process.argv.includes('--hidden') && !S.firstRun;
    createPopup();
    createWidget();
    createMain(!startHidden);
    createTray();
    if (S.firstRun) { S.firstRun = false; save(); }
    applyAutostart();
    ensureStartMenuShortcut();
    powerMonitor.on('resume', restartCountdown);
    powerMonitor.on('unlock-screen', restartCountdown);
    screen.on('display-removed', () => { if (widgetWin && !onSomeDisplay(S.widgetPos)) { S.widgetPos = null; const wa = screen.getPrimaryDisplay().workArea; widgetWin.setPosition(wa.x + wa.width - WIDGET_W - 12, wa.y + 12); } });
    setInterval(tick, 1000);
    broadcast();
  });
}
