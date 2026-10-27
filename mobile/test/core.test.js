const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Core = require('../src/core.js');

test('bundled shared modules match the desktop source', { skip: !fs.existsSync(path.resolve(__dirname, '../../renderer/data.js')) }, () => {
  for (const name of ['data.js', 'i18n.js']) {
    assert.equal(fs.readFileSync(path.resolve(__dirname, '../src/shared', name), 'utf8'),
      fs.readFileSync(path.resolve(__dirname, '../../renderer', name), 'utf8'));
  }
});

test('corrupt saved values cannot replace settings or add unknown stretch history', () => {
  const s = Core.cleanState({ interval: -3, lang: 'bad', workDays: [1, 1, 9],
    history: { '2026-10-27': { total: 2, by: { chin: 1, madeUp: 40 }, water: -5 } } });
  assert.equal(s.interval, 20);
  assert.equal(s.lang, 'en');
  assert.deepEqual(s.workDays, [1]);
  assert.deepEqual(s.history['2026-10-27'], { total: 2, water: 0, by: { chin: 1 } });
});

test('recording a stretch and water updates the shared progress rules', () => {
  const at = new Date(2026, 9, 27, 10, 0);
  let s = Core.cleanState(null);
  s = Core.recordStretch(s, 'chin', at);
  s = Core.recordWater(s, at);
  assert.equal(Core.todayRecord(s, at).total, 1);
  assert.equal(Core.todayRecord(s, at).water, 1);
  assert.equal(Core.stats(s, at).total, 1);
  assert.equal(s.idx, 1);
  assert.equal(Core.availableKuih(s, at).length >= 4, true);
  const other = Core.recordStretch(s, 'wrist', at);
  assert.equal(other.idx, 1, 'a manually chosen stretch does not advance the regular cycle');
});

test('scheduled reminders respect workdays, lunch, pause and the iOS pending limit', () => {
  const tuesday = new Date(2026, 9, 27, 12, 45);
  const s = Core.cleanState({ notificationsOn: true, waterOn: false,
    pauseUntil: new Date(2026, 9, 27, 14, 0).getTime() });
  const plan = Core.reminderPlan(s, tuesday);
  assert.equal(plan.length, 60);
  assert.equal(new Date(plan[0].at).getHours(), 14);
  assert.ok(plan.every(e => {
    const d = new Date(e.at), minute = d.getHours() * 60 + d.getMinutes();
    return s.workDays.includes(d.getDay()) && minute >= s.workStart && minute < s.workEnd &&
      !(minute >= s.lunchStart && minute < s.lunchEnd);
  }));
  assert.deepEqual(Core.reminderPlan({ ...s, notificationsOn: false }, tuesday), []);
});

test('unrestricted schedule still pauses both stretch and water alerts', () => {
  const now = new Date(2026, 9, 27, 9, 0);
  const s = Core.cleanState({ notificationsOn: true, workOn: false, pauseUntil: now.getTime() + 2 * 60 * 60_000 });
  const plan = Core.reminderPlan(s, now);
  assert.equal(plan.length, 60);
  assert.ok(plan.every(e => e.at >= s.pauseUntil));
});

test('finishing a stretch schedules the next one after the selected interval', () => {
  const at = new Date(2026, 9, 27, 9, 25, 10);
  const s = Core.recordStretch(Core.cleanState({ notificationsOn: true, waterOn: false }), 'chin', at);
  const next = Core.reminderPlan(s, at)[0];
  assert.equal(next.at, at.getTime() + s.interval * 60_000);
});
