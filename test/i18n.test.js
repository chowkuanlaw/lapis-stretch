'use strict';
// Every English text has a Bahasa Melayu version with the same {placeholders}.
const test = require('node:test');
const assert = require('node:assert/strict');
const I = require('../renderer/i18n.js');
const D = require('../renderer/data.js');

const holes = s => (String(s).match(/\{\w+\}/g) || []).sort().join(',');

test('every English key has a Malay version', () => {
  const missing = Object.keys(I.STR.en).filter(k => !Object.prototype.hasOwnProperty.call(I.STR.ms, k));
  assert.deepEqual(missing, []);
  const extra = Object.keys(I.STR.ms).filter(k => !Object.prototype.hasOwnProperty.call(I.STR.en, k));
  assert.deepEqual(extra, [], 'Malay keys with no English version');
});

test('placeholders match between English and Malay', () => {
  const bad = Object.keys(I.STR.en).filter(k => holes(I.STR.en[k]) !== holes(I.STR.ms[k]));
  assert.deepEqual(bad, []);
});

test('no empty text', () => {
  for (const lang of I.LANGS) for (const [k, v] of Object.entries(I.STR[lang])) assert.ok(typeof v === 'string' && v.trim(), lang + ' ' + k);
});

test('stretches and kuih have their Malay text', () => {
  for (const e of D.EX) for (const f of ['name', 'cue', 'dose', 'steps']) assert.ok(e.ms && e.ms[f], e.id + ' ms.' + f);
  for (const e of D.EX) assert.equal(e.ms.steps.length, e.steps.length, e.id + ' has the same number of steps');
  for (const k of D.KUIH) for (const f of ['origin', 'note']) assert.ok(k.ms && k.ms[f], k.id + ' ms.' + f);
});

test('each festival has a name and a greeting in both languages', () => {
  for (const id of Object.keys(D.FESTIVAL_DAYS)) for (const lang of I.LANGS) {
    assert.ok(I.STR[lang]['fest.' + id], lang + ' fest.' + id);
    assert.ok(I.STR[lang]['greet.' + id], lang + ' greet.' + id);
  }
});

test('every unlock rule has text in both languages', () => {
  for (const r of D.RULES) for (const lang of I.LANGS) assert.ok(I.STR[lang]['rule.' + r.type], lang + ' rule.' + r.type);
});

test('t() fills placeholders and falls back to English', () => {
  assert.equal(I.t('en', 'water.count', { n: 3, g: 8 }), '3 of 8 glasses');
  assert.equal(I.t('xx', 'water.title'), 'Water');
  assert.equal(I.t('ms', 'no.such.key'), 'no.such.key');
});

test("every What's new item has text in both languages, and versions are newest first", () => {
  for (const x of D.NEWS) for (const k of x.keys) for (const lang of I.LANGS) assert.ok(I.STR[lang][k], lang + ' ' + k);
  for (let i = 1; i < D.NEWS.length; i++) assert.ok(D.newer(D.NEWS[i - 1].v, D.NEWS[i].v), D.NEWS[i - 1].v + ' before ' + D.NEWS[i].v);
  assert.equal(D.newer('1.10.0', '1.9.0'), true);
  assert.equal(D.newer('1.9.0', '1.9.0'), false);
});

test("the current version has a What's new entry", () => {
  const v = require('../package.json').version;
  assert.ok(D.NEWS.some(x => x.v === v) || /\.\d*[1-9]$/.test(v), 'add NEWS items for ' + v + ' (patch releases may skip)');
});

// 1.13.0: Chinese (zh) and Tamil (ta) have to be complete too.
test('all four languages are loaded', () => assert.deepEqual(I.LANGS, ['en', 'ms', 'zh', 'ta']));

test('every language has every English key, with the same placeholders', () => {
  for (const lang of I.LANGS.filter(l => l !== 'en')) {
    const missing = Object.keys(I.STR.en).filter(k => !Object.prototype.hasOwnProperty.call(I.STR[lang], k));
    assert.deepEqual(missing, [], lang + ' is missing keys');
    assert.deepEqual(Object.keys(I.STR[lang]).filter(k => !(k in I.STR.en)), [], lang + ' has unknown keys');
    assert.deepEqual(Object.keys(I.STR.en).filter(k => holes(I.STR.en[k]) !== holes(I.STR[lang][k])), [], lang + ' placeholders');
  }
});

test('every language has its stretch, kuih and group text', () => {
  for (const lang of I.LANGS.filter(l => l !== 'en')) {
    for (const e of D.EX) {
      for (const f of ['name', 'cue', 'dose']) assert.ok(I.tx(lang, e, f) && (lang === 'ms' || I.tx(lang, e, f) !== e[f]), `${lang} ${e.id}.${f}`);
      assert.equal(I.tx(lang, e, 'steps').length, e.steps.length, `${lang} ${e.id} step count`);
    }
    for (const k of D.KUIH) for (const f of ['origin', 'note']) assert.ok(I.tx(lang, k, f), `${lang} ${k.id}.${f}`);
    for (const g of D.KUIH_GROUPS) for (const f of ['title', 'sub']) assert.ok(I.tx(lang, g, f), `${lang} ${g.id}.${f}`);
  }
});

test('Chinese and Tamil are written in their own scripts, with the product names kept', () => {
  const han = /[\u4e00-\u9fff]/, tamil = /[\u0B80-\u0BFF]/;
  for (const [k, v] of Object.entries(I.STR.zh)) if (!/^(version|rule\.progress|prog\.dayToday|greet\.kaamatan|greet\.gawai)$/.test(k) && !/Lapis|Jom/.test(v)) assert.match(v, han, 'zh ' + k);
  for (const [k, v] of Object.entries(I.STR.ta)) if (!/^(version|rule\.progress|night\.title|wrap\.tag|teh\.btn|greet\.kaamatan|greet\.gawai)$/.test(k) && !/Lapis/.test(v)) assert.match(v, tamil, 'ta ' + k);
  assert.equal(I.locale('zh'), 'zh-CN'); assert.equal(I.locale('ta'), 'ta-MY'); assert.equal(I.locale('xx'), 'en-GB');
  assert.equal(I.tx('xx', D.BY.chin, 'name'), 'Chin tucks');
});

test('weekday labels: seven in every language', () => {
  for (const lang of I.LANGS) assert.equal(I.t(lang, 'days').split(',').length, 7, lang);
});
