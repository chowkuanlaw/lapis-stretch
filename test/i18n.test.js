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
