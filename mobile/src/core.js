'use strict';

// The catalogue, translations and progress rules are the same ones used by Electron.
const Data = require('./shared/data.js');
const I18N = require('./shared/i18n.js');

const MINUTE = 60_000;
const DEFAULTS = {
  lang: 'en', kuih: 'lapis', collect: true, idx: 0, history: {},
  interval: 20, snooze: 10, goal: 8, waterGoal: 8,
  workOn: true, workDays: [1, 2, 3, 4, 5], workStart: 540, workEnd: 1080,
  lunchOn: true, lunchStart: 780, lunchEnd: 840,
  waterOn: true, waterEvery: 60, ramadanOn: true, streakSaver: true,
  notificationsOn: false, nextDue: 0, pauseUntil: 0, onboarded: false
};

const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const int = (value, lo, hi) => Number.isInteger(value) && value >= lo && value <= hi;
const dateKey = Data.dayKey;

function cleanState(raw) {
  const state = { ...DEFAULTS, workDays: [...DEFAULTS.workDays], history: {} };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return state;
  for (const key of ['collect', 'workOn', 'lunchOn', 'waterOn', 'ramadanOn', 'streakSaver', 'notificationsOn', 'onboarded']) {
    if (typeof raw[key] === 'boolean') state[key] = raw[key];
  }
  if (I18N.LANGS.includes(raw.lang)) state.lang = raw.lang;
  if (own(Data.KUIH_BY, raw.kuih)) state.kuih = raw.kuih;
  if ([15, 20, 30, 45, 60].includes(raw.interval)) state.interval = raw.interval;
  if ([5, 10, 15].includes(raw.snooze)) state.snooze = raw.snooze;
  if ([30, 45, 60, 90, 120].includes(raw.waterEvery)) state.waterEvery = raw.waterEvery;
  for (const [key, lo, hi] of [['goal', 1, 30], ['waterGoal', 1, 20], ['idx', 0, 1e9], ['workStart', 0, 1410], ['workEnd', 30, 1440], ['lunchStart', 0, 1410], ['lunchEnd', 30, 1440], ['nextDue', 0, 1e15], ['pauseUntil', 0, 1e15]]) {
    if (int(raw[key], lo, hi)) state[key] = raw[key];
  }
  if (state.workStart >= state.workEnd) { state.workStart = DEFAULTS.workStart; state.workEnd = DEFAULTS.workEnd; }
  if (state.lunchStart >= state.lunchEnd) { state.lunchStart = DEFAULTS.lunchStart; state.lunchEnd = DEFAULTS.lunchEnd; }
  if (Array.isArray(raw.workDays)) {
    const days = [...new Set(raw.workDays.filter(d => int(d, 0, 6)))].sort();
    if (days.length) state.workDays = days;
  }
  if (raw.history && typeof raw.history === 'object' && !Array.isArray(raw.history)) {
    for (const day of Object.keys(raw.history).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort().slice(-400)) {
      const entry = raw.history[day];
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      const by = {};
      if (entry.by && typeof entry.by === 'object' && !Array.isArray(entry.by)) {
        for (const id of Object.keys(entry.by)) {
          if (own(Data.BY, id) && int(entry.by[id], 1, 9999)) by[id] = entry.by[id];
        }
      }
      state.history[day] = {
        total: int(entry.total, 0, 99999) ? entry.total : 0,
        water: int(entry.water, 0, 99) ? entry.water : 0,
        by
      };
    }
  }
  return state;
}

function todayRecord(state, now = new Date()) {
  return state.history[dateKey(now)] || { total: 0, water: 0, by: {} };
}

function cycleChoice(state, now = new Date()) {
  let idx = state.idx;
  const fasting = state.ramadanOn && Data.ramadanOn(now);
  for (let count = 0; count < Data.CYCLE.length; count++, idx++) {
    const id = Data.CYCLE[idx % Data.CYCLE.length];
    if (!(fasting && id === 'walk')) return { exercise: Data.BY[id], index: idx };
  }
  return { exercise: Data.BY[Data.CYCLE[0]], index: idx };
}

function nextExercise(state, now = new Date()) {
  return cycleChoice(state, now).exercise;
}

function recordStretch(state, id, now = new Date()) {
  if (!own(Data.BY, id)) return state;
  const day = dateKey(now), old = todayRecord(state, now);
  const by = { ...old.by, [id]: (old.by[id] || 0) + 1 };
  const choice = cycleChoice(state, now);
  return {
    ...state, idx: choice.exercise.id === id ? choice.index + 1 : state.idx,
    nextDue: now.getTime() + state.interval * MINUTE,
    history: { ...state.history, [day]: { ...old, total: old.total + 1, by } }
  };
}

function recordWater(state, now = new Date()) {
  const day = dateKey(now), old = todayRecord(state, now);
  return { ...state, history: { ...state.history, [day]: { ...old, water: (old.water || 0) + 1 } } };
}

function stats(state, now = new Date()) {
  return Data.computeStats(state.history, state.goal, state.workOn ? state.workDays : null, now,
    { saver: state.streakSaver, waterGoal: state.waterGoal });
}

function availableKuih(state, now = new Date()) {
  const s = stats(state, now);
  return Data.KUIH.filter(k => !state.collect || Data.STARTERS.includes(k.id) ||
    (Data.RULE_BY[k.id] && Data.ruleProgress(Data.RULE_BY[k.id], s).done));
}

// Keep below iOS's 64-pending-notification limit. Refill when the app opens.
function reminderPlan(state, now = new Date(), limit = 60) {
  if (!state.notificationsOn || !int(limit, 1, 60)) return [];
  const earliest = Math.max(now.getTime() + MINUTE, state.nextDue || 0, state.pauseUntil || 0);
  const events = [];
  const fasting = state.ramadanOn && Data.ramadanOn(now);
  if (!state.workOn) {
    for (let n = 1; n <= limit + 10; n++) {
      const at = now.getTime() + n * state.interval * MINUTE;
      if (at >= earliest) events.push({ kind: 'stretch', at });
    }
    if (state.waterOn && !fasting) {
      for (let n = 1; n <= limit + 10; n++) {
        const at = now.getTime() + n * state.waterEvery * MINUTE;
        if (at >= (state.pauseUntil || 0)) events.push({ kind: 'water', at });
      }
    }
  } else {
    for (let offset = 0; offset < 21 && events.length < limit * 2; offset++) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
      if (!state.workDays.includes(day.getDay())) continue;
      for (const [kind, every] of [['stretch', state.interval], ['water', state.waterEvery]]) {
        if (kind === 'water' && (!state.waterOn || (state.ramadanOn && Data.ramadanOn(day)))) continue;
        const workStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, state.workStart).getTime();
        const workEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, state.workEnd).getTime();
        const first = kind === 'stretch' && offset === 0
          ? Math.max(workStart + every * MINUTE, state.nextDue || 0)
          : workStart + every * MINUTE;
        for (let at = first; at < workEnd; at += every * MINUTE) {
          const d = new Date(at), minute = d.getHours() * 60 + d.getMinutes();
          if (state.lunchOn && minute >= state.lunchStart && minute < state.lunchEnd) continue;
          if (at >= (kind === 'stretch' ? earliest : now.getTime() + MINUTE) && at >= (state.pauseUntil || 0)) {
            events.push({ kind, at });
          }
        }
      }
    }
  }
  return events.sort((a, b) => a.at - b.at || (a.kind === 'stretch' ? -1 : 1)).slice(0, limit);
}

module.exports = { Data, I18N, DEFAULTS, cleanState, todayRecord, nextExercise, recordStretch, recordWater, stats, availableKuih, reminderPlan };
