'use strict';
/*
 * Lapis settings: the defaults, and cleanState(), which reads a saved state.json back safely.
 * Only known settings with the right types are kept; anything else falls back to the default.
 * Kept separate from main.js so the automatic tests can check it (test/state.test.js).
 */
const fs = require('fs');
const path = require('path');
const { BY, KUIH_BY, dayKey } = require('./renderer/data.js');
const I18N = require('./renderer/i18n.js');
const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);

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
  goldFound: {}, flagDay: '', remix: false, lastTeh: '', lastNight: '',
  // 1.8.0
  seenVersion: '', theme: 'auto', trayRing: true, pauseUntil: 0, chimeStyle: 'bell', volume: 70, widgetHideFull: true,
  // 1.9.0
  streakSaver: true, textSize: 'normal'
};
const TEXT_SIZES = { normal: 1, large: 1.15, larger: 1.3 };
const THEMES = ['auto', 'light', 'dark'];
const CHIMES = ['bell', 'marimba', 'soft', 'pop'];
const WATER_EVERY = [30, 45, 60, 90, 120];

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
    'workOn', 'lunchOn', 'quietMeetings', 'waterOn', 'summaryOn', 'collect', 'codeUnlocked', 'collectInit', 'ramadanOn', 'wrapOn', 'remix', 'trayRing', 'widgetHideFull', 'streakSaver']) {
    if (typeof saved[k] === 'boolean') out[k] = saved[k];
  }
  pick('pausedLeft', num(saved.pausedLeft, 0, 24 * 3600e3));
  pick('pauseUntil', num(saved.pauseUntil, 0, 1e15));
  pick('volume', int(saved.volume, 0, 100));
  if (THEMES.includes(saved.theme)) out.theme = saved.theme;
  if (CHIMES.includes(saved.chimeStyle)) out.chimeStyle = saved.chimeStyle;
  if (own(TEXT_SIZES, saved.textSize)) out.textSize = saved.textSize;
  if (typeof saved.seenVersion === 'string' && /^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(saved.seenVersion)) out.seenVersion = saved.seenVersion;
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

/* ---------- safe saving (1.11.0) ----------
   state.json is written to a temporary file first and then swapped in, so a power cut mid-save
   can't leave a half-written file. Once a day the last good copy is kept as state.bak.json,
   and if state.json can't be read, Lapis starts from that backup instead of from nothing. */
const MAIN = 'state.json', BAK = 'state.bak.json', TMP = 'state.json.tmp';
const parseFile = f => { const v = JSON.parse(fs.readFileSync(f, 'utf8')); return v && typeof v === 'object' && !Array.isArray(v) ? v : null; };
function readStateFile(dir) {
  for (const name of [MAIN, BAK]) {
    try { const saved = parseFile(path.join(dir, name)); if (saved) return { saved, from: name }; } catch (e) { /* try the next one */ }
  }
  return { saved: null, from: null };
}
function writeStateFile(dir, state, now) {
  const main = path.join(dir, MAIN), tmp = path.join(dir, TMP), bak = path.join(dir, BAK);
  const today = dayKey(now ? new Date(now) : new Date());
  try {
    let bakDay = '';
    try { bakDay = dayKey(fs.statSync(bak).mtime); } catch (e) { /* no backup yet */ }
    if (bakDay !== today) {
      try {
        if (parseFile(main)) { fs.copyFileSync(main, bak); const t = new Date(); fs.utimesSync(bak, t, t); } // Windows keeps the old date on copies
      } catch (e) { /* nothing good to back up */ }
    }
    const fd = fs.openSync(tmp, 'w');
    try { fs.writeSync(fd, JSON.stringify(state)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    try { fs.renameSync(tmp, main); } catch (e) { fs.writeFileSync(main, JSON.stringify(state)); try { fs.unlinkSync(tmp); } catch (e2) { /* ignore */ } }
    return true;
  } catch (e) { return false; }
}

module.exports = { DEFAULTS, WATER_EVERY, THEMES, CHIMES, TEXT_SIZES, cleanState, readStateFile, writeStateFile };
