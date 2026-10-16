'use strict';
/*
 * Lapis — stretch reminder for Windows.
 * The main process owns the timer and all state, so reminders keep firing
 * even when every window is hidden. Windows only render what they are sent.
 *   main window : dashboard, settings, stretch library (closing hides it to the tray)
 *   widget      : small always-on-top countdown card on the desktop
 *   popup       : the reminder card that slides up in the bottom-right corner
 */
const { app, BrowserWindow, Tray, Menu, ipcMain, screen, Notification, nativeImage, nativeTheme, shell, powerMonitor, net, protocol, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { CYCLE, BY, KUIH_BY } = require('./renderer/data.js');

const AUMID = 'app.lapis.stretch';
const AWAY_SECS = 300;          // 5 min without keyboard/mouse = away from desk
const POPUP_W = 440, WIDGET_W = 300, WIDGET_H = 100;
const ICON = path.join(__dirname, 'assets', 'icon.png');
const TRAY_ICON = path.join(__dirname, 'assets', process.platform === 'win32' ? 'tray.ico' : 'tray.png');
// Updates come from this repository's GitHub releases; this is the only network traffic Lapis makes.
const REPO = 'chowkuanlaw/lapis-stretch';
const RELEASES_URL = `https://github.com/${REPO}/releases/latest`;
const LATEST_API = `https://api.github.com/repos/${REPO}/releases/latest`;
const UPDATE_EVERY = 24 * 3600e3;
// The windows load the app's own pages from lapis://app/ (never file:// or the web).
const SCHEME = 'lapis', ORIGIN = `${SCHEME}://app`, RENDERER_DIR = path.join(__dirname, 'renderer');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml' };
const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
protocol.registerSchemesAsPrivileged([{ scheme: SCHEME, privileges: { standard: true, secure: true } }]);

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
    history: {}, widgetPos: null, firstRun: true, autoUpdate: true, lastUpdateCheck: 0, kuih: 'lapis', onboarded: false,
    closedAt: 0, reopenHidden: false // for picking up where Lapis left off after a quick restart
  };
  const stateFile = () => path.join(app.getPath('userData'), 'state.json');
  let S = Object.assign({}, DEFAULTS);
  const R = { mode: 'waiting', cur: null, activeEnd: 0, activeSecs: 0, switched: false, dueAt: 0, rechimes: 0, msgUntil: 0, awaySince: null, update: null, updateMsg: '', checking: false };

  let mainWin = null, widgetWin = null, popupWin = null, eggWin = null, eggSafety = null, eggMsgUntil = 0, tray = null, quitting = false;
  let popupH = 230, saveTimer = null, lastDay = dayKey(new Date()), resumeHidden = false;

  // Only known settings with the right types are read back from disk; anything else falls back to the default.
  function cleanState(saved) {
    const out = JSON.parse(JSON.stringify(DEFAULTS));
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return out;
    const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : undefined);
    const pick = (k, v) => { if (v !== undefined) out[k] = v; };
    pick('interval', [15, 20, 30, 45, 60].includes(saved.interval) ? saved.interval : undefined);
    pick('snooze', [5, 10, 15].includes(saved.snooze) ? saved.snooze : undefined);
    for (const k of ['sound', 'toast', 'widget', 'widgetOnTop', 'autostart', 'awayReset', 'paused', 'firstRun', 'autoUpdate', 'onboarded']) {
      if (typeof saved[k] === 'boolean') out[k] = saved[k];
    }
    pick('pausedLeft', num(saved.pausedLeft, 0, 24 * 3600e3));
    pick('idx', Number.isInteger(saved.idx) ? num(saved.idx, 0, 1e9) : undefined);
    pick('lastUpdateCheck', num(saved.lastUpdateCheck, 0, 1e15));
    pick('nextDue', num(saved.nextDue, 0, 1e15));
    pick('closedAt', num(saved.closedAt, 0, 1e15));
    if (typeof saved.reopenHidden === 'boolean') out.reopenHidden = saved.reopenHidden;
    if (own(KUIH_BY, saved.kuih)) out.kuih = saved.kuih;
    const wp = saved.widgetPos;
    if (wp && typeof wp === 'object' && num(wp.x, -1e5, 1e5) !== undefined && num(wp.y, -1e5, 1e5) !== undefined) out.widgetPos = { x: Math.round(wp.x), y: Math.round(wp.y) };
    const h = saved.history;
    if (h && typeof h === 'object' && !Array.isArray(h)) {
      for (const day of Object.keys(h).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().slice(-400)) {
        const v = h[day]; if (!v || typeof v !== 'object') continue;
        const by = {};
        if (v.by && typeof v.by === 'object') for (const id of Object.keys(v.by)) if (own(BY, id) && Number.isInteger(v.by[id]) && v.by[id] > 0 && v.by[id] < 1e4) by[id] = v.by[id];
        out.history[day] = { total: Number.isInteger(v.total) && v.total >= 0 && v.total < 1e5 ? v.total : 0, by };
      }
    }
    // People upgrading from 1.2 or earlier already know Lapis: skip the first-launch setup.
    if (saved.onboarded === undefined) out.onboarded = true;
    return out;
  }
  function loadState() {
    let saved = null;
    try { saved = JSON.parse(fs.readFileSync(stateFile(), 'utf8')); } catch (e) { saved = null; }
    S = cleanState(saved);
    if (S.paused) S.pausedLeft = Math.max(S.pausedLeft || 0, 0);
    // Back within a few minutes (an update restart, or quit and reopen): carry on with the same countdown.
    // A launch after a longer break (e.g. first thing in the morning) starts a fresh countdown instead of firing at once.
    const now = Date.now(), off = now - S.closedAt;
    const quickRestart = S.closedAt > 0 && off >= 0 && off < AWAY_SECS * 1000 && S.nextDue > 0;
    S.nextDue = quickRestart ? Math.min(Math.max(S.nextDue, now + 5000), now + S.interval * 60e3) : now + S.interval * 60e3;
    resumeHidden = quickRestart && S.reopenHidden;
    S.closedAt = 0; S.reopenHidden = false;
  }
  function writeNow() { try { fs.writeFileSync(stateFile(), JSON.stringify(S)); } catch (e) { /* best effort */ } }
  function writeOnQuit() { clearTimeout(saveTimer); S.closedAt = Date.now(); writeNow(); }
  function save() { clearTimeout(saveTimer); saveTimer = setTimeout(writeNow, 300); }

  function pad(n) { return String(n).padStart(2, '0'); }
  function dayKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function mmss(ms) { const t = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(t / 60)}:${pad(t % 60)}`; }
  function today() { const k = dayKey(new Date()); return S.history[k] || (S.history[k] = { total: 0, by: {} }); }
  function upNext() { return BY[CYCLE[S.idx % CYCLE.length]]; }

  function publicState() {
    const { widgetPos, firstRun, lastUpdateCheck, closedAt, reopenHidden, ...rest } = S;
    return Object.assign(rest, {
      mode: R.mode, cur: R.cur, upNext: upNext().id, activeEnd: R.activeEnd, activeSecs: R.activeSecs,
      switched: R.switched, away: !!R.awaySince,
      eggMsg: Date.now() < eggMsgUntil,
      version: app.getVersion(), installed: INSTALLED, update: R.update, updateMsg: R.updateMsg, checking: R.checking
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
    R.cur = own(BY, exId) ? exId : upNext().id;
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

  /* ---------- updates ---------- */
  // Installed copies (from Lapis-Setup.exe) update themselves with electron-updater:
  // check, download in the background, then "Restart to update" (or install on quit).
  // The portable zip can't replace itself, so it only checks and offers a Download link.
  const INSTALLED = app.isPackaged && fs.existsSync(path.join(process.resourcesPath, 'app-update.yml'));
  let autoUpdater = null, readyNotified = false;
  if (INSTALLED) {
    try {
      ({ autoUpdater } = require('electron-updater'));
      autoUpdater.logger = null;
      autoUpdater.autoDownload = true;
      autoUpdater.autoInstallOnAppQuit = true;
      autoUpdater.on('update-available', info => {
        R.update = { version: info.version, state: 'downloading', percent: 0 };
        R.updateMsg = `Downloading Lapis ${info.version}...`; broadcast();
      });
      autoUpdater.on('update-not-available', () => { R.update = null; R.updateMsg = 'You have the latest version'; broadcast(); });
      autoUpdater.on('download-progress', p => {
        if (!R.update || R.update.state !== 'downloading') return;
        const pc = Math.floor(p.percent || 0);
        if (pc !== R.update.percent) { R.update.percent = pc; broadcast(); }
      });
      autoUpdater.on('update-downloaded', info => {
        R.update = { version: info.version, state: 'ready' };
        R.updateMsg = `Lapis ${info.version} is ready to install`; broadcast();
        notifyReady(info.version);
      });
      autoUpdater.on('error', () => {
        if (R.update && R.update.state === 'downloading') R.update = null;
        R.updateMsg = "Couldn't update just now. Lapis will try again later."; R.checking = false; broadcast();
      });
    } catch (e) { autoUpdater = null; }
  }
  function isNewer(a, b) {
    const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
    return false;
  }
  async function checkForUpdate(manual) {
    if (R.checking) return;
    if (R.update && (R.update.state === 'downloading' || R.update.state === 'ready')) { if (manual) broadcast(); return; }
    R.checking = true; if (manual) R.updateMsg = 'Checking...';
    S.lastUpdateCheck = Date.now(); save(); broadcast();
    if (autoUpdater) {
      try { await autoUpdater.checkForUpdates(); }
      catch (e) { if (manual) R.updateMsg = "Couldn't reach GitHub. Check your connection and try again."; }
      R.checking = false; broadcast();
      return;
    }
    try {
      // Portable copy: a plain public request for the latest release tag. Nothing about you is sent.
      const res = await net.fetch(LATEST_API, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Lapis' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const tag = String((await res.json()).tag_name || '');
      const m = /^v?(\d+\.\d+\.\d+)$/.exec(tag);
      if (m && isNewer(m[1], app.getVersion())) { R.update = { version: m[1], state: 'available' }; R.updateMsg = `Lapis ${m[1]} is available`; }
      else { R.update = null; R.updateMsg = 'You have the latest version'; }
    } catch (e) {
      if (manual) R.updateMsg = "Couldn't reach GitHub. Check your connection and try again.";
    }
    R.checking = false; broadcast();
  }
  function notifyReady(version) {
    if (readyNotified || !Notification.isSupported()) return;
    readyNotified = true;
    const n = new Notification({ title: 'Lapis update ready', body: `Restart Lapis to update to ${version}. It will also install the next time you quit.`, icon: ICON, silent: true });
    n.on('click', showMain);
    n.show();
  }
  function installUpdate() {
    if (!autoUpdater || !R.update || R.update.state !== 'ready') return;
    quitting = true;
    S.reopenHidden = !(mainWin && !mainWin.isDestroyed() && mainWin.isVisible()); // come back the way you left it
    writeOnQuit();
    setImmediate(() => autoUpdater.quitAndInstall(true, true)); // silent install, then reopen Lapis
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
      case 'kuih': if (!own(KUIH_BY, value)) return; S.kuih = value; break;
      case 'onboarded': S.onboarded = !!value; break;
      case 'autoUpdate':
        S.autoUpdate = !!value;
        if (S.autoUpdate) setTimeout(() => checkForUpdate(false), 0);
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
    if (S.autoUpdate && !R.checking && now - (S.lastUpdateCheck || 0) > UPDATE_EVERY) checkForUpdate(false);
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
  function viewURL(view, extra) { return `${ORIGIN}/index.html?` + new URLSearchParams(Object.assign({ view }, extra || {})); }
  function loadView(win, view, extra) { win.loadURL(viewURL(view, extra)); }
  // Serves only files inside the renderer folder, read-only.
  function serveApp(req) {
    let u; try { u = new URL(req.url); } catch (e) { return new Response('', { status: 400 }); }
    const rel = decodeURIComponent(u.pathname).replace(/^\/+/, '');
    const file = path.resolve(RENDERER_DIR, rel || 'index.html');
    const type = MIME[path.extname(file).toLowerCase()];
    if (u.host !== 'app' || req.method !== 'GET' || !type || !file.startsWith(RENDERER_DIR + path.sep)) return new Response('', { status: 404 });
    return net.fetch(pathToFileURL(file).toString()).then(r => new Response(r.body, { status: r.status, headers: { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff' } }))
      .catch(() => new Response('', { status: 404 }));
  }
  // IPC is only accepted from Lapis's own pages.
  function trusted(evt) {
    const f = evt.senderFrame;
    return !!f && !f.parent && typeof f.url === 'string' && f.url.startsWith(ORIGIN + '/');
  }

  function createMain(show) {
    mainWin = new BrowserWindow({
      width: 1120, height: 760, minWidth: 720, minHeight: 560, show: false, title: 'Lapis',
      icon: ICON, backgroundColor: bg(), autoHideMenuBar: true, webPreferences: webPrefs()
    });
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

  /* ---------- easter egg: a full-screen dance over the desktop ---------- */
  function startEgg(a, from) {
    if (eggWin && !eggWin.isDestroyed()) return;
    // Where the tapped kuih is on screen: its spot inside the window plus the window's position.
    let pt = screen.getCursorScreenPoint();
    if (from && !from.isDestroyed() && Number.isFinite(+a.rx) && Number.isFinite(+a.ry)) {
      const b = from.getContentBounds();
      pt = { x: Math.round(b.x + +a.rx), y: Math.round(b.y + +a.ry) };
    }
    const d = screen.getDisplayNearestPoint(pt).bounds;
    eggWin = new BrowserWindow({
      x: d.x, y: d.y, width: d.width, height: d.height, frame: false, transparent: true, resizable: false, movable: false,
      minimizable: false, maximizable: false, fullscreenable: false, skipTaskbar: true, hasShadow: false, alwaysOnTop: true,
      show: false, title: 'Lapis', icon: ICON, webPreferences: webPrefs({ backgroundThrottling: false })
    });
    eggWin.setAlwaysOnTop(true, 'screen-saver');
    loadView(eggWin, 'egg', { fx: String(pt.x - d.x), fy: String(pt.y - d.y) });
    eggWin.once('ready-to-show', () => { if (eggWin && !eggWin.isDestroyed()) { eggWin.show(); eggWin.focus(); } });
    eggWin.on('closed', () => { eggWin = null; });
    clearTimeout(eggSafety);
    eggSafety = setTimeout(endEgg, 15000); // never leave the overlay stuck on screen
  }
  function endEgg() {
    clearTimeout(eggSafety);
    if (eggWin && !eggWin.isDestroyed()) eggWin.destroy();
    eggWin = null;
    eggMsgUntil = Date.now() + 2500;
    broadcast();
    setTimeout(broadcast, 2600);
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
    const u = R.update, updateItems = !u ? [] : [
      u.state === 'ready' ? { label: `Restart to update to Lapis ${u.version}`, click: installUpdate }
        : u.state === 'downloading' ? { label: `Downloading Lapis ${u.version}... ${u.percent || 0}%`, enabled: false }
        : { label: `Download Lapis ${u.version}`, click: openReleases },
      { type: 'separator' }
    ];
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
  // The widget window draws the chosen kuih at tray sizes and sends PNGs here.
  function setTrayIcon(images) {
    if (!tray || !Array.isArray(images)) return;
    const img = nativeImage.createEmpty();
    for (const it of images.slice(0, 4)) {
      const url = it && typeof it.url === 'string' ? it.url : '';
      const scale = Number(it && it.scale);
      if (!url.startsWith('data:image/png;base64,') || url.length > 200000 || !(scale >= 1 && scale <= 4)) continue;
      img.addRepresentation({ scaleFactor: scale, dataURL: url });
    }
    if (!img.isEmpty()) tray.setImage(img);
  }
  function updateTray() { if (tray) tray.setToolTip(`Lapis · ${statusLabel()}`); }

  /* ---------- Windows integration ---------- */
  function applyAutostart() {
    if (!app.isPackaged) return;
    try { app.setLoginItemSettings({ openAtLogin: S.autostart, path: process.execPath, args: ['--hidden'] }); } catch (e) { /* ignore */ }
  }
  function ensureStartMenuShortcut() {
    // A Start Menu shortcut carrying the AppUserModelID is what lets Windows show toast notifications.
    if (process.platform !== 'win32' || !app.isPackaged || INSTALLED) return; // the installer makes its own
    try {
      const lnk = path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Lapis.lnk');
      shell.writeShortcutLink(lnk, fs.existsSync(lnk) ? 'replace' : 'create', {
        target: process.execPath, args: '', description: 'Lapis stretch reminder', icon: process.execPath, iconIndex: 0, appUserModelId: AUMID
      });
    } catch (e) { /* ignore */ }
  }

  /* ---------- IPC ---------- */
  ipcMain.handle('get-state', evt => (trusted(evt) ? publicState() : null));
  ipcMain.on('action', (evt, a) => {
    if (!trusted(evt) || !a || typeof a !== 'object' || typeof a.type !== 'string') return;
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
      case 'install-update': installUpdate(); break;
      case 'egg': startEgg(a, BrowserWindow.fromWebContents(evt.sender)); break;
      case 'egg-done': endEgg(); break;
      case 'tray-icon': setTrayIcon(a.images); break;
      default: break;
    }
  });

  /* ---------- lifecycle ---------- */
  app.on('second-instance', showMain);
  // Defence in depth for every page Lapis ever creates: no new windows, no navigating away,
  // no embedded webviews, and no browser permissions (camera, mic, location, notifications...).
  app.on('web-contents-created', (_e, wc) => {
    wc.setWindowOpenHandler(() => ({ action: 'deny' }));
    wc.on('will-navigate', e => e.preventDefault());
    wc.on('will-redirect', e => e.preventDefault());
    wc.on('will-attach-webview', e => e.preventDefault());
  });
  app.on('window-all-closed', () => { /* keep running in the tray */ });
  app.on('before-quit', () => { quitting = true; writeOnQuit(); });

  app.whenReady().then(() => {
    protocol.handle(SCHEME, serveApp);
    const ses = session.defaultSession;
    ses.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
    ses.setPermissionCheckHandler(() => false);
    ses.setDevicePermissionHandler(() => false);
    ses.on('will-download', e => e.preventDefault());
    loadState();
    const startHidden = (process.argv.includes('--hidden') || resumeHidden) && !S.firstRun && S.onboarded; // the first-launch setup always shows
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
    if (S.autoUpdate) setTimeout(() => checkForUpdate(false), 8000); // check shortly after launch
  });
}
