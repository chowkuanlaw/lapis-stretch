'use strict';
/*
 * Lapis — stretch reminder for Windows.
 * The main process owns the timer and all state, so reminders keep firing
 * even when every window is hidden. Windows only render what they are sent.
 *   main window : dashboard, settings, stretch library (closing hides it to the tray)
 *   widget      : small always-on-top countdown card on the desktop
 *   popup       : the corner card: stretch reminders, water, new kuih and the Friday summary
 */
const { app, BrowserWindow, Tray, Menu, ipcMain, screen, Notification, nativeImage, nativeTheme, shell, powerMonitor, net, protocol, session } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const { CYCLE, BY, KUIH_BY, STARTERS, RULES, computeStats, ruleProgress, ramadanOn } = require('./renderer/data.js');
const I18N = require('./renderer/i18n.js');
const QUIET = require('./quiet.js');

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
// The secret code that unlocks every kuih, stored only as a salted SHA-256 hash.
const CODE_HASH = '236baef63139445e4254071641f6555ecb509cfa7fe905a4e8955812e7b712ea';
// Two more easter-egg codes (1.7.1), also stored only as hashes.
const CODE2_HASH = '79003147ddebca62535fbb1a7ad83d015c54f5f1d3b6a5a78d8a473d111ca984';
const CODE3_HASH = 'b2b506c1bc85f6c8b9c9137ce42e7cdf29f1f7f09a74c93b907eae9925184d52';
const GOLD_CHANCE = 1 / 200;
const MEETING_RECHECK = 60e3, AFTER_MEETING = 120e3, WATER_LATER = 15 * 60e3;
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
    closedAt: 0, reopenHidden: false, // for picking up where Lapis left off after a quick restart
    // 1.6.0
    lang: 'en', goal: 8,
    workOn: true, workDays: [1, 2, 3, 4, 5], workStart: 540, workEnd: 1080, lunchOn: true, lunchStart: 780, lunchEnd: 840, // minutes after midnight
    quietMeetings: true, waterOn: true, waterEvery: 60, waterGoal: 8, summaryOn: true, lastSummary: '',
    collect: true, unlocked: {}, codeUnlocked: false, collectInit: false,
    // 1.7.0
    ramadanOn: true, wrapOn: true, lastWrap: '',
    // 1.7.1 easter eggs
    goldFound: {}, flagDay: '', remix: false, lastTeh: '', lastNight: ''
  };
  const WATER_EVERY = [30, 45, 60, 90, 120];
  const stateFile = () => path.join(app.getPath('userData'), 'state.json');
  let S = JSON.parse(JSON.stringify(DEFAULTS));
  const R = {
    mode: 'waiting', cur: null, activeEnd: 0, activeSecs: 0, switched: false, dueAt: 0, rechimes: 0, msgUntil: 0, awaySince: null,
    update: null, updateMsg: null, checking: false,
    resting: false, quiet: false, quietCheck: false, nextWater: 0, waterCheck: false, notices: [], noticeUntil: 0, codeMsg: null, codeMsgUntil: 0,
    locked: 0, backMins: 0, backUntil: 0, wrapCheck: false, nextWrapCheck: 0,
    golden: false, eggCheck: false, nextEggCheck: 0, nightAgain: 0
  };

  let mainWin = null, widgetWin = null, popupWin = null, eggWin = null, eggSafety = null, eggMsgUntil = 0, tray = null, quitting = false;
  let popupH = 230, saveTimer = null, lastDay = dayKey(new Date()), resumeHidden = false;
  const t = (key, vars) => I18N.t(S.lang, key, vars);

  // Only known settings with the right types are read back from disk; anything else falls back to the default.
  function cleanState(saved) {
    const out = JSON.parse(JSON.stringify(DEFAULTS));
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return out;
    const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : undefined);
    const int = (v, lo, hi) => (Number.isInteger(v) ? num(v, lo, hi) : undefined);
    const pick = (k, v) => { if (v !== undefined) out[k] = v; };
    pick('interval', [15, 20, 30, 45, 60].includes(saved.interval) ? saved.interval : undefined);
    pick('snooze', [5, 10, 15].includes(saved.snooze) ? saved.snooze : undefined);
    for (const k of ['sound', 'toast', 'widget', 'widgetOnTop', 'autostart', 'awayReset', 'paused', 'firstRun', 'autoUpdate', 'onboarded',
      'workOn', 'lunchOn', 'quietMeetings', 'waterOn', 'summaryOn', 'collect', 'codeUnlocked', 'collectInit', 'ramadanOn', 'wrapOn', 'remix']) {
      if (typeof saved[k] === 'boolean') out[k] = saved[k];
    }
    pick('pausedLeft', num(saved.pausedLeft, 0, 24 * 3600e3));
    pick('idx', int(saved.idx, 0, 1e9));
    pick('lastUpdateCheck', num(saved.lastUpdateCheck, 0, 1e15));
    pick('nextDue', num(saved.nextDue, 0, 1e15));
    pick('closedAt', num(saved.closedAt, 0, 1e15));
    if (typeof saved.reopenHidden === 'boolean') out.reopenHidden = saved.reopenHidden;
    if (own(KUIH_BY, saved.kuih)) out.kuih = saved.kuih;
    if (I18N.LANGS.includes(saved.lang)) out.lang = saved.lang;
    pick('goal', int(saved.goal, 1, 30));
    if (Array.isArray(saved.workDays)) {
      const days = [...new Set(saved.workDays.filter(d => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
      if (days.length) out.workDays = days;
    }
    const or = (v, d) => (v === undefined ? d : v);
    const ws = or(int(saved.workStart, 0, 1410), out.workStart), we = or(int(saved.workEnd, 30, 1440), out.workEnd);
    if (ws < we) { out.workStart = ws; out.workEnd = we; }
    const ls = or(int(saved.lunchStart, 0, 1410), out.lunchStart), le = or(int(saved.lunchEnd, 30, 1440), out.lunchEnd);
    if (ls < le) { out.lunchStart = ls; out.lunchEnd = le; }
    pick('waterEvery', WATER_EVERY.includes(saved.waterEvery) ? saved.waterEvery : undefined);
    pick('waterGoal', int(saved.waterGoal, 1, 20));
    for (const k of ['lastSummary', 'lastWrap', 'flagDay', 'lastTeh', 'lastNight']) if (typeof saved[k] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(saved[k])) out[k] = saved[k];
    if (saved.unlocked && typeof saved.unlocked === 'object' && !Array.isArray(saved.unlocked)) {
      for (const id of Object.keys(saved.unlocked)) {
        const d = saved.unlocked[id];
        if (own(KUIH_BY, id) && typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) out.unlocked[id] = d;
      }
    }
    if (saved.goldFound && typeof saved.goldFound === 'object' && !Array.isArray(saved.goldFound)) {
      for (const id of Object.keys(saved.goldFound)) {
        const d = saved.goldFound[id];
        if (own(KUIH_BY, id) && typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) out.goldFound[id] = d;
      }
    }
    const wp = saved.widgetPos;
    if (wp && typeof wp === 'object' && num(wp.x, -1e5, 1e5) !== undefined && num(wp.y, -1e5, 1e5) !== undefined) out.widgetPos = { x: Math.round(wp.x), y: Math.round(wp.y) };
    const h = saved.history;
    if (h && typeof h === 'object' && !Array.isArray(h)) {
      for (const day of Object.keys(h).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().slice(-400)) {
        const v = h[day]; if (!v || typeof v !== 'object') continue;
        const by = {};
        if (v.by && typeof v.by === 'object') for (const id of Object.keys(v.by)) if (own(BY, id) && Number.isInteger(v.by[id]) && v.by[id] > 0 && v.by[id] < 1e4) by[id] = v.by[id];
        const rec = { total: Number.isInteger(v.total) && v.total >= 0 && v.total < 1e5 ? v.total : 0, by };
        if (Number.isInteger(v.water) && v.water > 0 && v.water < 100) rec.water = v.water;
        out.history[day] = rec;
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
    if (!saved || !I18N.LANGS.includes(saved.lang)) S.lang = /^ms/i.test(app.getLocale()) ? 'ms' : 'en';
    if (S.paused) S.pausedLeft = Math.max(S.pausedLeft || 0, 0);
    // Back within a few minutes (an update restart, or quit and reopen): carry on with the same countdown.
    // A launch after a longer break (e.g. first thing in the morning) starts a fresh countdown instead of firing at once.
    const now = Date.now(), off = now - S.closedAt;
    const quickRestart = S.closedAt > 0 && off >= 0 && off < AWAY_SECS * 1000 && S.nextDue > 0;
    S.nextDue = quickRestart ? Math.min(Math.max(S.nextDue, now + 5000), now + S.interval * 60e3) : now + S.interval * 60e3;
    resumeHidden = quickRestart && S.reopenHidden;
    S.closedAt = 0; S.reopenHidden = false;
    R.resting = S.workOn && !isWorkTime(new Date(now));
    R.nextWater = now + S.waterEvery * 60e3;
    collectionUpdate(true);
  }
  function writeNow() { try { fs.writeFileSync(stateFile(), JSON.stringify(S)); } catch (e) { /* best effort */ } }
  function writeOnQuit() { clearTimeout(saveTimer); S.closedAt = Date.now(); writeNow(); }
  function save() { clearTimeout(saveTimer); saveTimer = setTimeout(writeNow, 300); }

  function pad(n) { return String(n).padStart(2, '0'); }
  function dayKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function mmss(ms) { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${pad(s % 60)}`; }
  function today() { const k = dayKey(new Date()); return S.history[k] || (S.history[k] = { total: 0, by: {} }); }
  // Ramadan mode: no water reminders, and the walk (which ends with a drink) is left out of the cycle.
  const puasa = () => (S.ramadanOn ? ramadanOn(new Date()) : null);
  function skipWalk() { if (puasa()) { let n = 0; while (CYCLE[S.idx % CYCLE.length] === 'walk' && n++ < CYCLE.length) S.idx++; } }
  function upNext() { return BY[CYCLE[S.idx % CYCLE.length]]; }
  const exName = ex => I18N.tx(S.lang, ex, 'name');

  /* ---------- working hours ---------- */
  const minsOf = d => d.getHours() * 60 + d.getMinutes();
  function isWorkTime(d) {
    if (!S.workOn) return true;
    if (!S.workDays.includes(d.getDay())) return false;
    const m = minsOf(d);
    if (m < S.workStart || m >= S.workEnd) return false;
    return !(S.lunchOn && m >= S.lunchStart && m < S.lunchEnd);
  }
  // When working time starts again (start of day, or end of lunch), or null if never.
  function nextWorkStart(from) {
    if (!S.workOn) return from;
    for (let i = 0; i < 8; i++) {
      const day = new Date(from); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() + i);
      if (!S.workDays.includes(day.getDay())) continue;
      const starts = [S.workStart];
      if (S.lunchOn && S.lunchEnd > S.workStart && S.lunchEnd < S.workEnd) starts.push(S.lunchEnd);
      for (const m of starts) { const at = new Date(day); at.setMinutes(m); if (at.getTime() > from) return at.getTime(); }
    }
    return null;
  }
  function whenLabel(ts) {
    if (!ts) return '';
    const d = new Date(ts), loc = I18N.locale(S.lang);
    const time = d.toLocaleTimeString(loc, { hour: 'numeric', minute: '2-digit', hour12: true });
    return dayKey(d) === dayKey(new Date()) ? time : `${d.toLocaleDateString(loc, { weekday: 'short' })} ${time}`;
  }

  /* ---------- quiet during meetings (see quiet.js; no microphone check) ----------
     Checked only when a reminder is about to show, then once a minute while it waits. */
  async function isQuietTime() {
    if (!app.isPackaged && process.env.LAPIS_TEST_QUIET) { try { return fs.readFileSync(process.env.LAPIS_TEST_QUIET, 'utf8').trim() === '1'; } catch (e) { return false; } }
    return QUIET.fullScreenBusy() || (await QUIET.doNotDisturbOn());
  }
  async function dueOrHold() {
    if (!S.quietMeetings) { if (R.quiet) R.quiet = false; becomeDue(); return; }
    R.quietCheck = true;
    const quiet = await isQuietTime();
    R.quietCheck = false;
    if (R.mode !== 'waiting' || S.paused || R.resting) return;
    if (quiet) { S.nextDue = Date.now() + MEETING_RECHECK; if (!R.quiet) { R.quiet = true; broadcast(); } return; }
    if (R.quiet) { R.quiet = false; S.nextDue = Date.now() + AFTER_MEETING; broadcast(); return; } // 2 minutes after the meeting
    becomeDue();
  }

  /* ---------- kuih collection ---------- */
  const workDaysForStreak = () => (S.workOn ? S.workDays : null);
  function isAvailable(id) {
    return !S.collect || S.codeUnlocked || STARTERS.includes(id) || own(S.unlocked, id) || id === S.kuih;
  }
  function collectionUpdate(silent) {
    if (!S.collectInit) { // first run of 1.6: earn what the history already shows, and keep the kuih in use
      S.collectInit = true; silent = true;
      if (!STARTERS.includes(S.kuih)) S.unlocked[S.kuih] = '2000-01-01';
    }
    const stats = computeStats(S.history, S.goal, workDaysForStreak(), new Date());
    for (const r of RULES) {
      if (own(S.unlocked, r.id) || !ruleProgress(r, stats).done) continue;
      S.unlocked[r.id] = silent ? '2000-01-01' : dayKey(new Date()); // earned from past history: not "new this week"
      if (!silent && S.collect && !S.codeUnlocked) R.notices.push({ type: 'unlock', id: r.id });
    }
    save();
  }
  function redeem(code) {
    if (typeof code !== 'string' || code.length > 64) return;
    const norm = code.replace(/\s+/g, '').toUpperCase();
    const h = crypto.createHash('sha256').update('lapis:' + norm).digest('hex');
    if (h === CODE_HASH) { S.codeUnlocked = true; R.codeMsg = 'ok'; }
    else if (h === CODE2_HASH) { S.flagDay = dayKey(new Date()); R.codeMsg = 'flag'; }
    else if (h === CODE3_HASH) { S.remix = !S.remix; R.codeMsg = S.remix ? 'remixOn' : 'remixOff'; }
    else R.codeMsg = 'bad';
    R.codeMsgUntil = Date.now() + 9000;
    save(); broadcast();
    setTimeout(broadcast, 9100);
  }

  /* ---------- corner-card notices: water, new kuih, Friday summary ---------- */
  function pushNotice(n) { R.notices.push(n); broadcast(); }
  function closeNotice() { R.notices.shift(); R.noticeUntil = 0; broadcast(); }
  function waterDue(now) {
    if (R.waterCheck) return;
    if ((today().water || 0) >= S.waterGoal) { R.nextWater = now + S.waterEvery * 60e3; return; } // goal reached for today
    if (R.notices.some(n => n.type === 'water')) return;
    R.waterCheck = true;
    (S.quietMeetings ? isQuietTime() : Promise.resolve(false)).then(quiet => {
      R.waterCheck = false;
      if (quiet) { R.nextWater = Date.now() + 5 * 60e3; return; }
      R.nextWater = Date.now() + S.waterEvery * 60e3;
      pushNotice({ type: 'water', state: 'ask' });
      chime('water');
    });
  }
  function drankWater(fromCard) {
    const rec = today(); rec.water = (rec.water || 0) + 1;
    R.nextWater = Date.now() + S.waterEvery * 60e3;
    const i = R.notices.findIndex(n => n.type === 'water');
    if (fromCard && i === 0) { R.notices[0] = { type: 'water', state: 'done' }; R.noticeUntil = Date.now() + 4000; }
    else if (i >= 0) R.notices.splice(i, 1);
    save(); broadcast();
  }
  const mondayOf = d => { const x = new Date(d); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  function summaryDue(now) {
    if (!S.summaryOn) return;
    const d = new Date(now), order = day => (day + 6) % 7; // Monday first
    const days = S.workOn ? S.workDays : [5];
    const last = days.reduce((a, b) => (order(b) > order(a) ? b : a), days[0]);
    const end = S.workOn ? S.workEnd : 18 * 60;
    if (d.getDay() !== last || minsOf(d) < end - 30 || minsOf(d) > end + 180) return;
    const week = dayKey(mondayOf(d));
    if (S.lastSummary === week) return;
    S.lastSummary = week; save();
    pushNotice({ type: 'summary', week });
  }
  /* Easter eggs (1.7.1): teh tarik on Friday at 3:30 pm, and "go to sleep" late at night.
     Each shows once (a week, a night), only while you're at the PC and not in a meeting. */
  const isNight = d => d.getHours() >= 23 || d.getHours() < 5;
  const nightKey = d => dayKey(new Date(d.getTime() - 5 * 3600e3)); // 1 am still belongs to the evening before
  function eggNotices(now) {
    if (R.eggCheck || now < R.nextEggCheck) return;
    const d = new Date(now), m = minsOf(d);
    let want = null;
    if (d.getDay() === 5 && m >= 930 && m < 960 && !R.resting && !S.paused && S.lastTeh !== dayKey(mondayOf(d))) want = 'teh';
    else if (isNight(d) && (S.lastNight !== nightKey(d) || (R.nightAgain && now >= R.nightAgain))) want = 'night';
    if (!want || R.notices.some(n => n.type === want)) return;
    let idle = 0; try { idle = powerMonitor.getSystemIdleTime(); } catch (e) { /* ignore */ }
    if (idle >= 60 || R.locked) { R.nextEggCheck = now + 30e3; return; } // only while you're using the PC
    R.eggCheck = true;
    (S.quietMeetings ? isQuietTime() : Promise.resolve(false)).then(quiet => {
      R.eggCheck = false;
      if (quiet) { R.nextEggCheck = Date.now() + MEETING_RECHECK; return; }
      if (want === 'teh') S.lastTeh = dayKey(mondayOf(d)); else { S.lastNight = nightKey(d); R.nightAgain = 0; }
      save();
      pushNotice(want === 'teh' ? { type: 'teh' } : { type: 'night', back: S.workOn ? nextWorkStart(Date.now()) : 0 });
      chime(want === 'teh' ? 'done' : 'water');
    });
  }

  /* End-of-day wrap-up (1.7.0): once a working day, when your working hours end and you're still at the PC.
     On the day the Friday summary shows, the summary says goodbye instead. */
  function wrapDue(now) {
    if (!S.wrapOn || !S.workOn || S.paused || R.wrapCheck || now < R.nextWrapCheck) return;
    const d = new Date(now), k = dayKey(d), m = minsOf(d);
    if (S.lastWrap === k || !S.workDays.includes(d.getDay()) || m < S.workEnd || m > S.workEnd + 120) return;
    const lastDay = S.workDays.reduce((a, b) => ((b + 6) % 7 > (a + 6) % 7 ? b : a), S.workDays[0]);
    if (S.summaryOn && d.getDay() === lastDay) return; // the weekly summary says goodbye that day
    let idle = 0; try { idle = powerMonitor.getSystemIdleTime(); } catch (e) { /* ignore */ }
    if (idle >= AWAY_SECS || R.locked) { R.nextWrapCheck = now + 30e3; return; } // say it when you're back at the desk
    R.wrapCheck = true;
    (S.quietMeetings ? isQuietTime() : Promise.resolve(false)).then(quiet => {
      R.wrapCheck = false;
      if (quiet) { R.nextWrapCheck = Date.now() + MEETING_RECHECK; return; }
      S.lastWrap = k; save();
      pushNotice({ type: 'wrap', day: k });
      chime('done');
    });
  }

  function publicState() {
    const { widgetPos, firstRun, lastUpdateCheck, closedAt, reopenHidden, collectInit, ...rest } = S;
    return Object.assign(rest, {
      mode: R.mode, cur: R.cur, upNext: upNext().id, activeEnd: R.activeEnd, activeSecs: R.activeSecs,
      switched: R.switched, away: !!R.awaySince,
      resting: R.resting, backAt: R.resting ? nextWorkStart(Date.now()) : 0, quiet: R.quiet,
      nextWater: S.waterOn && !R.resting && !puasa() ? R.nextWater : 0, notice: R.notices[0] || null,
      ramadan: puasa(), backMins: Date.now() < R.backUntil ? R.backMins : 0,
      golden: R.golden && (R.mode === 'due' || R.mode === 'active' || R.mode === 'done'),
      codeMsg: Date.now() < R.codeMsgUntil ? R.codeMsg : null,
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
    const n = new Notification({ title: t('toast.title'), body: `${exName(ex)} · ${I18N.tx(S.lang, ex, 'dose')}`, icon: ICON, silent: true });
    n.on('click', () => { positionPopup(); popupWin.showInactive(); });
    n.show();
  }
  function becomeDue(exId, quiet) {
    R.cur = own(BY, exId) ? exId : upNext().id;
    R.mode = 'due'; R.dueAt = Date.now(); R.rechimes = 0; R.quiet = false;
    // Easter egg: now and then a scheduled reminder brings a golden kuih (a hidden badge, found by luck only).
    R.golden = !quiet && (Math.random() < GOLD_CHANCE || (!app.isPackaged && !!process.env.LAPIS_TEST_GOLD));
    if (R.golden && !own(S.goldFound, S.kuih)) { S.goldFound[S.kuih] = dayKey(new Date()); save(); }
    const w = R.notices.findIndex(n => n.type === 'water'); // the stretch takes the corner; water asks again later
    if (w >= 0) { R.notices.splice(w, 1); R.nextWater = Date.now() + WATER_LATER; }
    if (!quiet) { chime('due'); toast(BY[R.cur]); }
    broadcast();
  }
  function start() {
    const ex = BY[R.cur || upNext().id];
    R.cur = ex.id; R.mode = 'active'; R.activeSecs = ex.secs; R.activeEnd = Date.now() + ex.secs * 1000; R.switched = false;
    broadcast();
  }
  function schedule(ms) { S.nextDue = Date.now() + ms; if (S.paused) S.pausedLeft = ms; save(); }
  function advance() { if (R.cur === upNext().id) S.idx++; skipWalk(); }
  function finish() {
    const rec = today(); rec.total++; rec.by[R.cur] = (rec.by[R.cur] || 0) + 1;
    advance(); schedule(S.interval * 60e3); chime('done');
    R.mode = 'done'; R.msgUntil = Date.now() + 5000;
    collectionUpdate(false);
    setTimeout(() => { R.golden = false; }, 5200);
    broadcast();
  }
  function skip() { advance(); schedule(S.interval * 60e3); R.mode = 'waiting'; R.cur = null; R.golden = false; broadcast(); }
  function snooze() { schedule(S.snooze * 60e3); R.mode = 'snoozed'; R.msgUntil = Date.now() + 3500; broadcast(); }
  function different() {
    const base = R.cur || upNext().id; let i = S.idx;
    do { i++; } while (CYCLE[i % CYCLE.length] === base || (puasa() && CYCLE[i % CYCLE.length] === 'walk'));
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
  // Back from sleep: start a fresh countdown, and clear a reminder that waited while the PC slept.
  function restartCountdown() {
    if (S.paused || R.resting) return;
    if (R.mode === 'due' && S.awayReset) { R.mode = 'waiting'; R.cur = null; }
    if (R.mode === 'waiting') { R.awaySince = null; R.quiet = false; schedule(S.interval * 60e3); broadcast(); }
  }
  /* Away from the desk (1.7.0): 5 minutes without keyboard or mouse, or a locked screen for a minute or more,
     counts as a break. Coming back clears a reminder that was waiting and starts a fresh countdown. */
  function backFromAway(now) {
    const since = R.awaySince; R.awaySince = null;
    if (!since || now - since < 60e3) { broadcast(); return; }
    if (R.mode === 'due') { R.mode = 'waiting'; R.cur = null; }
    R.quiet = false; schedule(S.interval * 60e3);
    R.backMins = Math.max(1, Math.round((now - since) / 60e3)); R.backUntil = now + 15000;
    broadcast(); setTimeout(broadcast, 15100);
  }

  /* ---------- updates ---------- */
  // Installed copies (from Lapis-Setup.exe) update themselves with electron-updater:
  // check, download in the background, then "Restart to update" (or install on quit).
  // The portable zip can't replace itself, so it only checks and offers a Download link.
  const INSTALLED = app.isPackaged && fs.existsSync(path.join(process.resourcesPath, 'app-update.yml'));
  const msg = (k, v) => ({ k, v: v || {} });
  let autoUpdater = null, readyNotified = false;
  if (INSTALLED) {
    try {
      ({ autoUpdater } = require('electron-updater'));
      autoUpdater.logger = null;
      autoUpdater.autoDownload = true;
      autoUpdater.autoInstallOnAppQuit = true;
      autoUpdater.on('update-available', info => {
        R.update = { version: info.version, state: 'downloading', percent: 0 };
        R.updateMsg = msg('upd.downloading', { v: info.version }); broadcast();
      });
      autoUpdater.on('update-not-available', () => { R.update = null; R.updateMsg = msg('upd.latest'); broadcast(); });
      autoUpdater.on('download-progress', p => {
        if (!R.update || R.update.state !== 'downloading') return;
        const pc = Math.floor(p.percent || 0);
        if (pc !== R.update.percent) { R.update.percent = pc; broadcast(); }
      });
      autoUpdater.on('update-downloaded', info => {
        R.update = { version: info.version, state: 'ready' };
        R.updateMsg = msg('upd.ready', { v: info.version }); broadcast();
        notifyReady(info.version);
      });
      autoUpdater.on('error', () => {
        if (R.update && R.update.state === 'downloading') R.update = null;
        R.updateMsg = msg('upd.error'); R.checking = false; broadcast();
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
    R.checking = true; if (manual) R.updateMsg = msg('upd.checking');
    S.lastUpdateCheck = Date.now(); save(); broadcast();
    if (autoUpdater) {
      try { await autoUpdater.checkForUpdates(); }
      catch (e) { if (manual) R.updateMsg = msg('upd.offline'); }
      R.checking = false; broadcast();
      return;
    }
    try {
      // Portable copy: a plain public request for the latest release tag. Nothing about you is sent.
      const res = await net.fetch(LATEST_API, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Lapis' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const tag = String((await res.json()).tag_name || '');
      const m = /^v?(\d+\.\d+\.\d+)$/.exec(tag);
      if (m && isNewer(m[1], app.getVersion())) { R.update = { version: m[1], state: 'available' }; R.updateMsg = msg('upd.available', { v: m[1] }); }
      else { R.update = null; R.updateMsg = msg('upd.latest'); }
    } catch (e) {
      if (manual) R.updateMsg = msg('upd.offline');
    }
    R.checking = false; broadcast();
  }
  function notifyReady(version) {
    if (readyNotified || !Notification.isSupported()) return;
    readyNotified = true;
    const n = new Notification({ title: t('toast.readyTitle'), body: t('toast.readyBody', { v: version }), icon: ICON, silent: true });
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
    const half = v => Number.isInteger(+v) && +v % 30 === 0;
    switch (key) {
      case 'interval': S.interval = [15, 20, 30, 45, 60].includes(+value) ? +value : 20; if (R.mode === 'waiting') schedule(S.interval * 60e3); break;
      case 'snooze': S.snooze = [5, 10, 15].includes(+value) ? +value : 10; break;
      case 'sound': case 'toast': case 'awayReset': case 'quietMeetings': case 'summaryOn': case 'wrapOn': S[key] = !!value; break;
      case 'ramadanOn': S.ramadanOn = !!value; skipWalk(); break;
      case 'widget': S.widget = !!value; syncWidget(); break;
      case 'widgetOnTop': S.widgetOnTop = !!value; if (widgetWin) widgetWin.setAlwaysOnTop(S.widgetOnTop, 'floating'); break;
      case 'autostart': S.autostart = !!value; applyAutostart(); break;
      case 'kuih': if (!own(KUIH_BY, value) || !isAvailable(value)) return; S.kuih = value; break;
      case 'onboarded': S.onboarded = !!value; break;
      case 'autoUpdate':
        S.autoUpdate = !!value;
        if (S.autoUpdate) setTimeout(() => checkForUpdate(false), 0);
        break;
      case 'lang': if (!I18N.LANGS.includes(value)) return; S.lang = value; break;
      case 'goal': { const g = Math.round(+value); if (!(g >= 1 && g <= 30)) return; S.goal = g; collectionUpdate(false); break; }
      case 'workOn': S.workOn = !!value; collectionUpdate(false); break;
      case 'lunchOn': S.lunchOn = !!value; break;
      case 'workDay': { // toggle one weekday, keeping at least one
        const d = +value; if (!(Number.isInteger(d) && d >= 0 && d <= 6)) return;
        const has = S.workDays.includes(d);
        if (has && S.workDays.length === 1) return;
        S.workDays = has ? S.workDays.filter(x => x !== d) : [...S.workDays, d].sort();
        break;
      }
      case 'workStart': if (!half(value) || +value >= S.workEnd || +value < 0) return; S.workStart = +value; break;
      case 'workEnd': if (!half(value) || +value <= S.workStart || +value > 1440) return; S.workEnd = +value; break;
      case 'lunchStart': if (!half(value) || +value >= S.lunchEnd || +value < 0) return; S.lunchStart = +value; break;
      case 'lunchEnd': if (!half(value) || +value <= S.lunchStart || +value > 1440) return; S.lunchEnd = +value; break;
      case 'waterOn': S.waterOn = !!value; R.nextWater = Date.now() + S.waterEvery * 60e3; if (!S.waterOn) R.notices = R.notices.filter(n => n.type !== 'water'); break;
      case 'waterEvery': if (!WATER_EVERY.includes(+value)) return; S.waterEvery = +value; R.nextWater = Date.now() + S.waterEvery * 60e3; break;
      case 'waterGoal': { const g = Math.round(+value); if (!(g >= 1 && g <= 20)) return; S.waterGoal = g; break; }
      case 'collect': S.collect = !!value; if (!S.collect) R.notices = R.notices.filter(n => n.type !== 'unlock'); break;
      default: return;
    }
    if (['workOn', 'workDay', 'workStart', 'workEnd', 'lunchOn', 'lunchStart', 'lunchEnd'].includes(key)) tick();
    save(); broadcast();
  }

  function tick() {
    const now = Date.now();
    // working hours: rest outside them, and start a fresh countdown when work starts again
    const resting = S.workOn && !isWorkTime(new Date(now));
    if (resting !== R.resting) {
      R.resting = resting;
      if (resting) { if (R.mode === 'due') { R.mode = 'waiting'; R.cur = null; } R.quiet = false; R.notices = R.notices.filter(n => n.type !== 'water'); }
      else { if (R.mode === 'waiting' && !S.paused) schedule(S.interval * 60e3); R.nextWater = now + S.waterEvery * 60e3; }
      broadcast();
    }
    if (S.awayReset && (R.mode === 'waiting' || R.mode === 'due') && !S.paused && !R.resting) {
      if (R.locked) { if (!R.awaySince) { R.awaySince = R.locked; broadcast(); } }
      else {
        let idle = 0; try { idle = powerMonitor.getSystemIdleTime(); } catch (e) { /* ignore */ }
        if (idle >= AWAY_SECS) { if (!R.awaySince) { R.awaySince = now - idle * 1000; broadcast(); } }
        else if (R.awaySince) backFromAway(now);
      }
    } else if (R.awaySince) { R.awaySince = null; broadcast(); }
    if (R.mode === 'waiting') skipWalk();

    if (R.mode === 'waiting' && !S.paused && !R.awaySince && !R.resting && !R.quietCheck && now >= S.nextDue) dueOrHold();
    else if (R.mode === 'due' && !R.awaySince && now - R.dueAt > (R.rechimes + 1) * 5 * 60e3) { R.rechimes++; chime('due'); }
    else if (R.mode === 'active') {
      const left = R.activeEnd - now, ex = BY[R.cur];
      if (ex.sides && !R.switched && left <= R.activeSecs * 500) { R.switched = true; chime('switch'); broadcast(); }
      if (left <= 0) finish();
    } else if ((R.mode === 'done' || R.mode === 'snoozed') && now >= R.msgUntil) { R.mode = 'waiting'; R.cur = null; broadcast(); }

    const fasting = puasa();
    if (fasting && R.notices.some(n => n.type === 'water')) { R.notices = R.notices.filter(n => n.type !== 'water'); broadcast(); }
    if (S.waterOn && !fasting && !R.resting && !S.paused && R.mode === 'waiting' && now >= R.nextWater) waterDue(now);
    if (R.noticeUntil && now >= R.noticeUntil) closeNotice();
    summaryDue(now);
    wrapDue(now);
    eggNotices(now);

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
    const want = R.mode !== 'waiting' || R.notices.length > 0;
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
    if (R.mode === 'due') return t('tray.due');
    if (R.mode === 'active') return t('tray.active', { ex: exName(ex) });
    if (R.mode === 'done') return t('tray.done');
    if (S.paused) return t('tray.paused');
    if (R.resting) return t('tray.resting', { when: whenLabel(nextWorkStart(Date.now())) });
    if (R.quiet) return t('tray.quiet');
    if (R.awaySince) return t('tray.away');
    return t('tray.next', { t: mmss(S.nextDue - Date.now()) });
  }
  function buildMenu() {
    const u = R.update, updateItems = !u ? [] : [
      u.state === 'ready' ? { label: t('tray.restart', { v: u.version }), click: installUpdate }
        : u.state === 'downloading' ? { label: t('tray.downloading', { v: u.version, p: u.percent || 0 }), enabled: false }
        : { label: t('tray.download', { v: u.version }), click: openReleases },
      { type: 'separator' }
    ];
    return Menu.buildFromTemplate([
      ...updateItems,
      { label: statusLabel(), enabled: false },
      { label: t('tray.today', { n: today().total }), enabled: false },
      { type: 'separator' },
      { label: t('tray.now'), click: () => becomeDue(null, true) },
      { label: S.paused ? t('resume') : t('pause'), click: togglePause },
      { type: 'separator' },
      { label: t('tray.open'), click: showMain },
      { label: t('tray.widget'), type: 'checkbox', checked: S.widget, click: m => setSetting('widget', m.checked) },
      { label: t('tray.autostart'), type: 'checkbox', checked: S.autostart, click: m => setSetting('autostart', m.checked) },
      { type: 'separator' },
      { label: t('tray.quit'), click: () => { quitting = true; app.quit(); } }
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
    const top = R.notices[0];
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
        const h = Math.max(120, Math.min(640, Math.round(+a.h || 0)));
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
      case 'water-drank': drankWater(true); break;
      case 'water-add': drankWater(false); break;
      case 'water-later': if (top && top.type === 'water') { R.nextWater = Date.now() + WATER_LATER; closeNotice(); } break;
      case 'notice-close': if (top) closeNotice(); break;
      case 'night-more': if (top && top.type === 'night') { R.nightAgain = Date.now() + 5 * 60e3; closeNotice(); } break;
      case 'unlock-use': if (top && top.type === 'unlock') { setSetting('kuih', top.id); closeNotice(); } break;
      case 'summary-open': if (top && top.type === 'summary') { closeNotice(); showMain(); } break;
      case 'redeem': redeem(a.code); break;
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
    // `Lapis.exe --self-test`: run the meeting checks once, note the result in Lapis's own folder, and exit.
    // The release workflow uses this to prove the packaged app can run them on Windows.
    if (process.argv.includes('--self-test')) {
      QUIET.notificationMode().then(mode => {
        try { fs.writeFileSync(path.join(app.getPath('userData'), 'self-test.json'), JSON.stringify({ state: QUIET.queryState(), mode, version: app.getVersion() })); } catch (e) { /* ignore */ }
        app.exit(0);
      });
      return;
    }
    loadState();
    // Development only (never in the installed app): show a corner notice on start, for testing.
    if (!app.isPackaged && process.env.LAPIS_TEST_NOTICE) { try { R.notices.push(JSON.parse(process.env.LAPIS_TEST_NOTICE)); } catch (e) { /* ignore */ } }
    const startHidden = (process.argv.includes('--hidden') || resumeHidden) && !S.firstRun && S.onboarded; // the first-launch setup always shows
    createPopup();
    createWidget();
    createMain(!startHidden);
    createTray();
    if (S.firstRun) { S.firstRun = false; save(); }
    applyAutostart();
    ensureStartMenuShortcut();
    powerMonitor.on('resume', restartCountdown);
    powerMonitor.on('lock-screen', () => { R.locked = Date.now(); });
    powerMonitor.on('unlock-screen', () => { R.locked = 0; tick(); });
    screen.on('display-removed', () => { if (widgetWin && !onSomeDisplay(S.widgetPos)) { S.widgetPos = null; const wa = screen.getPrimaryDisplay().workArea; widgetWin.setPosition(wa.x + wa.width - WIDGET_W - 12, wa.y + 12); } });
    setInterval(tick, 1000);
    broadcast();
    if (S.autoUpdate) setTimeout(() => checkForUpdate(false), 8000); // check shortly after launch
  });
}
