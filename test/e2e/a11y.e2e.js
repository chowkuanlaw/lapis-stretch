'use strict';
// Accessibility scan (axe-core) of every page, in light and dark. Fails on serious or critical problems.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { _electron: electron } = require('playwright');
const ROOT = path.join(__dirname, '..', '..');
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const wait = ms => new Promise(r => setTimeout(r, ms));

async function launch(state) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'lapis-a11y-'));
  const dir = path.join(home, 'Lapis'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify(state));
  const env = Object.assign({}, process.env, { XDG_CONFIG_HOME: home }); delete env.NODE_OPTIONS;
  const app = await electron.launch({ args: [ROOT, '--no-sandbox'], env, timeout: 60000 });
  return { app, close: async () => { await app.close().catch(() => {}); fs.rmSync(home, { recursive: true, force: true }); } };
}
async function win(app, name) {
  for (let i = 0; i < 100; i++) { const w = app.windows().find(p => p.url().includes('view=' + name)); if (w) { await w.waitForLoadState('domcontentloaded'); return w; } await wait(150); }
  throw new Error('no ' + name + ' window');
}
async function scan(w, label) {
  await w.evaluate(AXE);
  const r = await w.evaluate(() => axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] }));
  return r.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')
    .map(v => `${label}: ${v.id} (${v.impact}) ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')}`);
}

for (const theme of ['light', 'dark']) {
  test(`accessibility scan, ${theme} mode`, async () => {
    const history = {};
    for (let i = 1; i <= 25; i++) { const d = new Date(); d.setDate(d.getDate() - i); const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; history[k] = { total: i % 10, by: { chin: i % 10 }, water: i % 9 }; }
    const L = await launch({ onboarded: true, firstRun: false, workOn: false, theme, history, seenVersion: require('../../package.json').version });
    try {
      const w = await win(L.app, 'main');
      const found = [];
      await w.emulateMedia({ colorScheme: theme }); // the same switch Windows makes in Dark mode
      assert.equal(await w.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches), theme === 'dark', 'theme applied');
      for (const page of ['today', 'progress', 'stretches', 'kuih', 'settings']) {
        await w.locator(`.nav-item[data-page="${page}"]`).click();
        await w.locator(`.nav-item[data-page="${page}"][aria-current="page"]`).waitFor({ timeout: 3000 });
        await wait(400);
        found.push(...await scan(w, page));
        if (page === 'progress') { await w.locator('#tab-water').click(); await wait(300); found.push(...await scan(w, 'progress-water')); await w.locator('#tab-stretches').click(); }
        if (page === 'settings') for (const t of ['health', 'display', 'about']) { await w.locator(`[data-stab="${t}"]`).click(); await wait(200); found.push(...await scan(w, 'settings-' + t)); }
      }
      await w.locator('.nav-item[data-page="today"]').click();
      await w.locator('#card [data-act="now"], [data-act="now"]').first().click();
      const pop = await win(L.app, 'popup');
      await pop.locator('#card [data-act="start"]').waitFor({ timeout: 5000 });
      await pop.emulateMedia({ colorScheme: theme });
      found.push(...await scan(pop, 'reminder'));
      assert.deepEqual(found, []);
    } finally { await L.close(); }
  });
}

test('keyboard only: the sidebar and the stretch switches work without a mouse', async () => {
  const L = await launch({ onboarded: true, firstRun: false, workOn: false, seenVersion: require('../../package.json').version });
  try {
    const w = await win(L.app, 'main');
    await w.locator('.nav-item[data-page="stretches"]').focus();
    await w.keyboard.press('Enter');
    await w.locator('.nav-item[data-page="stretches"][aria-current="page"]').waitFor({ timeout: 3000 });
    const sw = w.locator('[data-exon="wrist"]');
    await sw.focus();
    await w.keyboard.press('Space');
    await w.locator('[data-exon="wrist"][aria-checked="false"]').waitFor({ timeout: 3000 });
    // every switch has a readable name for a screen reader
    const names = await w.locator('[data-exon]').evaluateAll(n => n.map(x => (x.getAttribute('aria-labelledby') || '').split(' ').map(id => (document.getElementById(id) || {}).textContent || '').join(' ').trim()));
    assert.ok(names.length >= 9 && names.every(n => n.length > 8), 'switches are named: ' + names.join(' | '));
  } finally { await L.close(); }
});
