'use strict';
// Dates and numbers: festivals, Ramadan, streaks and the kuih collection rules.
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../renderer/data.js');

const at = s => new Date(s + 'T12:00:00');
const rec = (total, water) => (water ? { total, by: total ? { chin: total } : {}, water } : { total, by: total ? { chin: total } : {} });

test('every festival date is a real, sorted date', () => {
  for (const [id, days] of Object.entries(D.FESTIVAL_DAYS)) {
    assert.ok(days.length > 0, id + ' has dates');
    for (const k of days) {
      assert.match(k, /^\d{4}-\d{2}-\d{2}$/, id + ' ' + k);
      assert.equal(D.dayKey(at(k)), k, id + ' ' + k + ' is a real date');
    }
    assert.deepEqual([...days].sort(), days, id + ' dates are in order');
  }
});

test('outfits show on the 4 days before a festival and on the day itself', () => {
  assert.equal(D.festivalOn(at('2026-11-03')), null);
  assert.deepEqual(D.festivalOn(at('2026-11-04')), { id: 'deepavali', day: '2026-11-08', daysLeft: 4 });
  assert.equal(D.festivalOn(at('2026-11-08')).daysLeft, 0);
  assert.equal(D.festivalOn(at('2026-11-09')), null);
  assert.equal(D.festivalOn(at('2026-12-25')).id, 'xmas');
  assert.equal(D.festivalOn(at('2027-08-31')).id, 'merdeka');
  assert.equal(D.festivalOn(at('2027-09-12')).id, 'malaysiaday');
});

test('when two festivals overlap, the closer one wins', () => {
  // Kaamatan (31 May) and Gawai (1 June)
  assert.equal(D.festivalOn(at('2027-05-30')).id, 'kaamatan');
  assert.equal(D.festivalOn(at('2027-05-31')).id, 'kaamatan');
  assert.equal(D.festivalOn(at('2027-06-01')).id, 'gawai');
});

test('Ramadan is the 30 days before Hari Raya', () => {
  assert.equal(D.ramadanOn(at('2027-02-07')), null);
  assert.deepEqual(D.ramadanOn(at('2027-02-08')), { day: 1, raya: '2027-03-10' });
  assert.equal(D.ramadanOn(at('2027-03-09')).day, 30);
  assert.equal(D.ramadanOn(at('2027-03-10')), null, 'not on Raya itself');
  for (const raya of D.FESTIVAL_DAYS.raya) {
    const d = at(raya); d.setDate(d.getDate() - 15);
    assert.ok(D.ramadanOn(d), 'mid-Ramadan before ' + raya);
  }
});

test('streaks count working days at the goal; weekends never break them', () => {
  const h = {
    '2026-10-08': rec(8), '2026-10-09': rec(9), // Thu, Fri
    '2026-10-10': rec(0), '2026-10-11': rec(0), // weekend
    '2026-10-12': rec(8), '2026-10-13': rec(10) // Mon, Tue
  };
  const s = D.computeStats(h, 8, [1, 2, 3, 4, 5], at('2026-10-13'));
  assert.equal(s.streak, 4);
  assert.equal(s.total, 35);
  assert.equal(s.goalDays, 4);
  // a working day below the goal breaks it
  const h2 = Object.assign({}, h, { '2026-10-12': rec(3) });
  assert.equal(D.computeStats(h2, 8, [1, 2, 3, 4, 5], at('2026-10-13')).streak, 1);
  // today doesn't break the streak until the day is over
  const h3 = Object.assign({}, h, { '2026-10-14': rec(2) });
  assert.equal(D.computeStats(h3, 8, [1, 2, 3, 4, 5], at('2026-10-14')).streak, 4);
});

test('streak saver: one missed working day a week keeps the streak, a second one breaks it', () => {
  const h = {
    '2026-10-05': rec(8), '2026-10-06': rec(8), '2026-10-07': rec(2), '2026-10-08': rec(8), '2026-10-09': rec(8), // Wed missed
    '2026-10-12': rec(8), '2026-10-13': rec(1), '2026-10-14': rec(1), '2026-10-15': rec(9) // Tue and Wed missed
  };
  const wk = [1, 2, 3, 4, 5];
  assert.equal(D.computeStats(h, 8, wk, at('2026-10-12'), { saver: true }).streak, 5);
  assert.equal(D.computeStats(h, 8, wk, at('2026-10-12'), { saver: false }).streak, 3);
  const s = D.computeStats(h, 8, wk, at('2026-10-15'), { saver: true });
  assert.equal(s.streak, 1);
  assert.equal(s.bestStreak, 5);
  assert.equal(D.computeStats(h, 8, wk, at('2026-10-12'), { saver: true }).saverUsed, false, 'a new week has its saver back');
});

test('water and goal-day rules count the right days', () => {
  const h = { '2026-10-05': rec(8, 8), '2026-10-06': rec(9, 9), '2026-10-07': rec(2, 3), '2026-10-08': rec(8, 8) };
  const s = D.computeStats(h, 8, [1, 2, 3, 4, 5], at('2026-10-08'), { waterGoal: 8 });
  assert.equal(s.waterDays, 3);
  assert.equal(s.goalDays, 3);
  assert.deepEqual(D.ruleProgress({ type: 'waterDays', n: 5 }, s), { have: 3, need: 5, done: false });
  assert.deepEqual(D.ruleProgress({ type: 'goalDaysN', n: 3 }, s), { have: 3, need: 3, done: true });
});

test('no history means nothing collected and no streak', () => {
  const s = D.computeStats({}, 8, [1, 2, 3, 4, 5], at('2026-10-13'));
  assert.equal(s.total, 0);
  assert.equal(s.streak, 0);
  for (const r of D.RULES) assert.equal(D.ruleProgress(r, s).done, false, r.id);
});

test('the collection has 28 kuih: 4 starters and a rule for each of the other 24', () => {
  assert.equal(D.KUIH.length, 28);
  assert.equal(D.STARTERS.length, 4);
  assert.equal(D.RULES.length, 24);
  assert.equal(new Set(D.RULES.map(r => r.id)).size, 24, 'one rule per kuih');
  for (const g of D.KUIH_GROUPS) assert.ok(D.KUIH.filter(k => k.group === g.id).length >= 6, g.id + ' has at least 6 kuih');
  for (const r of D.RULES) {
    assert.ok(D.KUIH_BY[r.id], r.id + ' is a kuih');
    assert.ok(!D.STARTERS.includes(r.id), r.id + ' is not a starter');
  }
  for (const id of D.CYCLE) assert.ok(D.BY[id], id + ' is a stretch');
});
