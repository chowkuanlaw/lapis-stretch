'use strict';
// Saved settings are read back safely: wrong types, unknown keys and broken files fall back to the defaults.
const test = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULTS, cleanState } = require('../state.js');

test('nothing saved, or a broken file, gives the defaults', () => {
  for (const bad of [null, undefined, 42, 'text', [], [1, 2]]) {
    const s = cleanState(bad);
    assert.equal(s.interval, DEFAULTS.interval);
    assert.deepEqual(s.history, {});
  }
});

test('unknown keys are dropped', () => {
  const s = cleanState({ evil: '<script>', __proto__: { polluted: true }, constructor: 1 });
  assert.equal(s.evil, undefined);
  assert.equal(s.polluted, undefined);
  assert.equal({}.polluted, undefined);
  assert.deepEqual(Object.keys(s).sort(), Object.keys(DEFAULTS).sort());
});

test('values of the wrong type or out of range fall back', () => {
  const s = cleanState({
    interval: 7, snooze: '10', sound: 'yes', goal: 500, waterGoal: -1, workStart: 600, workEnd: 500,
    kuih: 'pizza', lang: 'fr', theme: 'neon', chimeStyle: 'airhorn', volume: 300, pauseUntil: -5, seenVersion: '1.x'
  });
  assert.equal(s.interval, 20);
  assert.equal(s.snooze, 10);
  assert.equal(s.sound, true);
  assert.equal(s.goal, 8);
  assert.equal(s.waterGoal, 8);
  assert.equal(s.workStart, 540); assert.equal(s.workEnd, 1080); // start must be before end
  assert.equal(s.kuih, 'lapis');
  assert.equal(s.lang, 'en');
  assert.equal(s.theme, 'auto');
  assert.equal(s.chimeStyle, 'bell');
  assert.equal(s.volume, 70);
  assert.equal(s.pauseUntil, 0);
  assert.equal(s.seenVersion, '');
});

test('good values are kept', () => {
  const s = cleanState({
    interval: 45, goal: 10, kuih: 'onde', lang: 'ms', theme: 'dark', chimeStyle: 'marimba', volume: 30,
    workDays: [1, 3, 5], workStart: 480, workEnd: 1020, seenVersion: '1.7.1', unlocked: { onde: '2026-10-01' }
  });
  assert.equal(s.interval, 45);
  assert.equal(s.goal, 10);
  assert.equal(s.kuih, 'onde');
  assert.equal(s.lang, 'ms');
  assert.equal(s.theme, 'dark');
  assert.equal(s.chimeStyle, 'marimba');
  assert.equal(s.volume, 30);
  assert.deepEqual(s.workDays, [1, 3, 5]);
  assert.equal(s.workStart, 480);
  assert.equal(s.seenVersion, '1.7.1');
  assert.deepEqual(s.unlocked, { onde: '2026-10-01' });
});

test('history keeps only valid days and counts, and at most 400 days', () => {
  const h = { 'not-a-date': { total: 5 }, '2026-10-01': { total: 6, by: { chin: 3, hack: 9, neck: -1 }, water: 4 }, '2026-10-02': { total: 'x', water: 1000 } };
  for (let i = 0; i < 450; i++) { const d = new Date(2024, 0, 1 + i); h[d.toISOString().slice(0, 10)] = { total: 1 }; }
  const s = cleanState({ history: h });
  assert.equal(s.history['not-a-date'], undefined);
  assert.deepEqual(s.history['2026-10-01'], { total: 6, by: { chin: 3 }, water: 4 });
  assert.deepEqual(s.history['2026-10-02'], { total: 0, by: {} });
  assert.ok(Object.keys(s.history).length <= 400);
});

test('people upgrading from 1.2 or earlier skip the welcome screen', () => {
  assert.equal(cleanState({ interval: 20 }).onboarded, true);
  assert.equal(cleanState({ onboarded: false }).onboarded, false);
});
