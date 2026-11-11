'use strict';
// Click-through tests: start the real Lapis app (Electron, from this folder) and use it the way
// a person would. They catch what the unit tests can't, such as the 1.6.0-1.11.3 welcome screen
// bug where every choice looked fine but did nothing when clicked.
//
// Run: npm run test:e2e   (Linux needs a display; CI uses xvfb-run)
// Each test gets its own empty settings folder (XDG_CONFIG_HOME), so nothing touches a real install.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { _electron: electron } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const wait = ms => new Promise(r => setTimeout(r, ms));

async function launch(state, extraEnv) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'lapis-e2e-'));
  const dir = path.join(home, 'Lapis');
  fs.mkdirSync(dir, { recursive: true });
  if (state) fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify(state));
  const env = Object.assign({}, process.env, { XDG_CONFIG_HOME: home }, extraEnv || {});
  delete env.NODE_OPTIONS; // Electron refuses some Node options (e.g. --use-openssl-ca)
  const app = await electron.launch({ args: [ROOT, '--no-sandbox'], env, timeout: 60000 });
  const errors = [];
  const watch = page => {
    page.on('pageerror', e => errors.push(String(e && e.message || e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  };
  app.windows().forEach(watch);
  app.on('window', watch);
  const view = async name => {
    for (let i = 0; i < 100; i++) {
      const w = app.windows().find(p => p.url().includes('view=' + name));
      if (w) { await w.waitForLoadState('domcontentloaded'); return w; }
      await wait(150);
    }
    throw new Error('no ' + name + ' window');
  };
  const saved = async () => {
    await wait(900); // saves are written straight after each change
    return JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8'));
  };
  const close = async () => { await app.close().catch(() => {}); fs.rmSync(home, { recursive: true, force: true }); };
  return { app, view, saved, errors, close };
}

// Working hours off, so reminders behave the same whatever time of day the test runs.
const settled = { onboarded: true, firstRun: false, workOn: false, seenVersion: require('../../package.json').version };

test('welcome screen: every choice can be clicked and is saved', async () => {
  const L = await launch(null); // a brand-new user
  try {
    const w = await L.view('main');
    const ob = w.locator('#onboard');
    await ob.waitFor({ state: 'visible' });

    await ob.locator('[data-set="lang"][data-sval="ms"]').click();
    await assert.doesNotReject(w.locator('#obTitle0', { hasText: 'Hai' }).waitFor({ timeout: 3000 }), 'language switches to Malay');
    await ob.locator('[data-set="lang"][data-sval="en"]').click();

    await w.locator('#obNext').click();
    const tile = ob.locator('.ktile:visible').nth(1);
    const kid = await tile.getAttribute('data-kid');
    await tile.click();
    await assert.doesNotReject(ob.locator(`.ktile[data-kid="${kid}"][aria-pressed="true"]`).waitFor({ timeout: 3000 }), 'kuih can be picked');

    await w.locator('#obNext').click();
    await ob.locator('[data-set="interval"][data-val="45"]').click();
    await w.locator('#obNext').click();
    await ob.locator('select[data-set="workStart"]').selectOption('480');
    await ob.locator('.switch[data-set="lunchOn"]').click();
    await w.locator('#obNext').click();
    await w.locator('#obNext').click();
    await ob.waitFor({ state: 'hidden' });

    const s = await L.saved();
    assert.equal(s.onboarded, true);
    assert.equal(s.kuih, kid);
    assert.equal(s.interval, 45);
    assert.equal(s.workStart, 480);
    assert.equal(s.lunchOn, false);
    assert.deepEqual(L.errors, []);
  } finally { await L.close(); }
});

test('every page opens, and Settings changes are saved', async () => {
  const L = await launch(settled);
  try {
    const w = await L.view('main');
    for (const page of ['progress', 'stretches', 'kuih', 'settings', 'today']) {
      await w.locator(`.nav-item[data-page="${page}"]`).click();
      await assert.doesNotReject(w.locator(`.nav-item[data-page="${page}"][aria-current="page"]`).waitFor({ timeout: 3000 }), page + ' opens');
    }
    await w.locator('.nav-item[data-page="settings"]').click();
    const health = w.locator('[data-stab="health"]');
    if (await health.count()) await health.click();
    await w.locator('button[data-step="goal"][data-d="1"]').click();
    assert.equal((await L.saved()).goal, 9, 'daily goal + works');
    assert.deepEqual(L.errors, []);
  } finally { await L.close(); }
});

test('a stretch can be started and finished, from the main window and the pop-up', async () => {
  const L = await launch(settled);
  try {
    const w = await L.view('main');
    await w.locator('#card [data-act="now"], [data-act="now"]').first().click();
    const pop = await L.view('popup');
    await pop.locator('#card [data-act="start"]').waitFor({ timeout: 5000 });
    await pop.locator('#card [data-act="start"]').click();
    await pop.locator('#card [data-act="done"]').click();
    const s = await L.saved();
    const today = Object.values(s.history || {}).reduce((n, d) => n + (d.total || 0), 0);
    assert.equal(today, 1, 'one stretch counted');
    assert.deepEqual(L.errors, []);
  } finally { await L.close(); }
});

test('a stretch can be switched off for reminders, and the last one stays on', async () => {
  const L = await launch(settled);
  try {
    const w = await L.view('main');
    await w.locator('.nav-item[data-page="stretches"]').click();
    const sw = id => w.locator(`[data-exon="${id}"]`);
    await sw('wrist').waitFor({ timeout: 3000 });
    await sw('wrist').click();
    await assert.doesNotReject(w.locator('[data-exon="wrist"][aria-checked="false"]').waitFor({ timeout: 3000 }), 'switch turns off');
    assert.ok((await L.saved()).exOff.includes('wrist'), 'saved');
    await sw('wrist').click();
    await assert.doesNotReject(w.locator('[data-exon="wrist"][aria-checked="true"]').waitFor({ timeout: 3000 }), 'switch turns back on');
    assert.deepEqual((await L.saved()).exOff, []);

    // Switch everything off except one: that one can't be switched off.
    const ids = await w.locator('[data-exon]').evaluateAll(n => n.map(x => x.dataset.exon));
    for (const id of ids.slice(1)) { await sw(id).click(); await wait(80); }
    await assert.doesNotReject(w.locator(`[data-exon="${ids[0]}"][aria-disabled="true"]`).waitFor({ timeout: 3000 }), 'last one is locked on');
    await sw(ids[0]).click({ force: true });
    const s = await L.saved();
    assert.ok(!s.exOff.includes(ids[0]), 'the last stretch stays on');
    assert.deepEqual(L.errors, []);
  } finally { await L.close(); }
});

// 1.13.0: the Store copy asks for a rating once, after 50 stretches and a 5-day streak. Other copies never ask.
const keen = () => {
  const history = {};
  for (let i = 0; i < 8; i++) { const d = new Date(); d.setDate(d.getDate() - i); const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; history[k] = { total: 8, by: { chin: 8 }, water: 8 }; }
  return Object.assign({}, settled, { history });
};

test('Store copy: asks for a rating once, and Rate or No thanks ends it', async () => {
  const L = await launch(Object.assign(keen(), { quietMeetings: false }), { LAPIS_TEST_STORE: '1', LAPIS_TEST_PRESENT: '1' });
  try {
    const pop = await L.view('popup');
    await pop.locator('[data-w="rate-go"]').waitFor({ timeout: 20000 });
    await pop.locator('[data-w="notice-close"]').click();
    assert.equal((await L.saved()).rateAsked, true, 'remembered, so it is never asked again');
    assert.deepEqual(L.errors, []);
  } finally { await L.close(); }
});

test('GitHub copy: never asks for a Store rating', async () => {
  const L = await launch(keen());
  try {
    await L.view('main');
    await wait(5000);
    const s = await L.saved();
    assert.ok(!s.rateAsked, 'not asked');
    for (const p of L.app.windows()) assert.equal(await p.locator('[data-w="rate-go"]').count(), 0, 'no rating question');
  } finally { await L.close(); }
});

test('language can be switched between English, Malay, Chinese and Tamil', async () => {
  const L = await launch(settled);
  try {
    const w = await L.view('main');
    await w.locator('.nav-item[data-page="settings"]').click();
    const tab = w.locator('[data-stab="display"]');
    if (await tab.count()) await tab.click();
    const want = { ms: 'Hari Ini', zh: '今天', ta: 'இன்று', en: 'Today' };
    for (const [lang, today] of Object.entries(want)) {
      await w.locator(`[data-set="lang"][data-sval="${lang}"]:visible`).click();
      await assert.doesNotReject(w.locator('.nav-item[data-page="today"]', { hasText: today }).waitFor({ timeout: 3000 }), lang + ' shows in the sidebar');
      assert.equal(await w.evaluate(() => document.documentElement.lang), { en: 'en', ms: 'ms', zh: 'zh-Hans', ta: 'ta' }[lang]);
    }
    assert.equal((await L.saved()).lang, 'en');
    assert.deepEqual(L.errors, []);
  } finally { await L.close(); }
});
