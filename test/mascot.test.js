'use strict';
// Every kuih can be drawn in every pose and outfit, and the drawing is well-formed SVG.
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = {};
require('../renderer/mascot.js');
const W = global.window;
const D = require('../renderer/data.js');
const POSES = ['idle', 'wave', 'chin', 'neck', 'thoracic', 'shoulders', 'twist', 'wrist', 'eyes', 'reach', 'walk', 'cheer', 'sleep',
  'wingsUp', 'wingsDown', 'mudraL', 'mudraR', 'salute', 'horse', 'glass', 'drink', 'shh', 'kick', 'tarik', 'yawn', 'flag', 'proud', 'drowsy', 'sad'];

test('every kuih in the collection has artwork, drawn in every pose and outfit', () => {
  const art = new Set(W.LAPIS_KUIH.map(k => k.id));
  for (const k of D.KUIH) assert.ok(art.has(k.id), k.id + ' has artwork');
  for (const k of W.LAPIS_KUIH) for (const pose of POSES) for (const outfit of [undefined, ...W.LAPIS_OUTFITS]) {
    const svg = W.lapisSVG(pose, '', false, k.id, outfit, pose === 'idle');
    assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'), `${k.id} ${pose} ${outfit}`);
    assert.ok(!/undefined|NaN/.test(svg), `${k.id} ${pose} ${outfit} has no undefined or NaN`);
    const open = (svg.match(/<g[\s>]/g) || []).length, close = (svg.match(/<\/g>/g) || []).length;
    assert.equal(open, close, `${k.id} ${pose} ${outfit}: groups are closed`);
  }
});

test('labels are escaped into the aria-label as plain text', () => {
  const svg = W.lapisSVG('idle', 'Kuih Lapis doing chin tucks', false, 'lapis');
  assert.match(svg, /aria-label="Kuih Lapis doing chin tucks"/);
});

test('unknown kuih or pose fall back safely', () => {
  assert.ok(W.lapisSVG('nope', '', false, 'pizza').includes('Kuih Lapis'));
  assert.ok(W.lapisBodySVG('pizza').startsWith('<svg'));
});
