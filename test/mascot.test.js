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

test('1.12.0 and 1.13.0: the animated stretches draw cleanly at every moment, for every kuih', () => {
  const MOVING = ['shoulders', 'reach', 'walk', 'eyes', 'breathe', 'arms', 'legs', 'calf', 'chin', 'neck', 'thoracic', 'twist', 'wrist']; // 1.12.0, 1.13.0, 1.14.0
  for (const id of MOVING) {
    assert.ok(D.EX.some(e => e.id === id), id + ' is a real stretch');
    const mv = W.lapisMove(id);
    assert.ok(mv && mv.period > 0, id + ' has a loop');
    for (let t = 0; t <= mv.period * 2; t += mv.period / 13) {
      const p = mv.at(t);
      assert.equal(p.arms.length, 2); assert.equal(p.legs.length, 2);
      for (const k of W.LAPIS_KUIH) {
        const svg = W.lapisSVG(p, '', false, k.id);
        assert.ok(!/undefined|NaN/.test(svg), `${id} at ${t.toFixed(2)}s, ${k.id}`);
      }
    }
  }
  // a kuih has no neck, spine or wrists, so these stay as still pictures with text
  for (const e of D.EX) assert.ok(W.lapisMove(e.id), e.id + ' is animated (1.14.0: all of them)');
  assert.equal(W.lapisMove('nope'), null);
  assert.equal(W.lapisMove('constructor'), null);
});

test('1.13.0: every stretch has a still pose that draws cleanly for every kuih', () => {
  for (const e of D.EX) for (const k of W.LAPIS_KUIH) {
    const svg = W.lapisSVG(e.pose, '', false, k.id);
    assert.ok(!/undefined|NaN/.test(svg), `${e.id}, ${k.id}`);
    assert.ok(svg.startsWith('<svg'), e.id);
  }
});

// 1.14.0: the pieces the 3D kuih (mascot3d.js) is built from come from the same drawings, so they must be complete too.
test('3D layers, art and faces are well-formed for every kuih, pose and outfit', () => {
  const R = W.LapisRig, closed = (s, what) => {
    assert.ok(!/undefined|NaN/.test(s), what + ' has no undefined or NaN');
    assert.equal((s.match(/<g[\s>]/g) || []).length, (s.match(/<\/g>/g) || []).length, what + ': groups are closed');
  };
  for (const k of W.LAPIS_KUIH) {
    for (const outfit of [undefined, ...W.LAPIS_OUTFITS]) for (const golden of [false, true]) {
      const art = R.artSVG(k.id, outfit, golden, 512);
      assert.ok(art.startsWith('<svg xmlns=') && art.endsWith('</svg>'), `${k.id} ${outfit} art`);
      closed(art, `${k.id} ${outfit} ${golden} art`);
    }
    for (const pose of POSES) for (const outfit of [undefined, ...W.LAPIS_OUTFITS]) {
      const L = R.layers(pose, k.id, outfit, pose === 'idle');
      assert.equal(L.sid, k.id);
      assert.equal(L.viewBox.length, 4);
      closed(L.over + L.under, `${k.id} ${pose} ${outfit} layers`);
      assert.ok(L.p && typeof L.p === 'object', `${k.id} ${pose} resolves to a pose`);
    }
  }
  for (const kind of ['', 'happy', 'closed', 'droopy']) for (const mouth of [undefined, 'none', 'flat', 'sad', 'yawn']) {
    const f = R.faceSVG(kind, mouth);
    assert.ok(f.startsWith('<svg xmlns=') && !/class="/.test(f), `face ${kind} ${mouth} is styled inline`);
  }
});

test('a stretch move frame gives the 3D layers a pose too', () => {
  for (const id of ['chin', 'neck', 'twist', 'walk', 'breathe']) {
    const m = W.lapisMove(id);
    const L = W.LapisRig.layers(m.at(1.3), 'lapis', 'raya', false);
    assert.ok(L.p.arms && L.p.legs && /rotate/.test(L.p.body), id);
  }
});

test('the 3D kuih wears a 3D hat, so the flat layer can leave the drawn hat out', () => {
  const R = W.LapisRig;
  for (const outfit of W.LAPIS_OUTFITS) {
    const withHat = R.layers('idle', 'lapis', outfit, false), without = R.layers('idle', 'lapis', outfit, false, { noHat: true });
    assert.ok(without.over.length < withHat.over.length, outfit + ': the hat is left out');
  }
  for (const k of W.LAPIS_KUIH) { const [y, flat] = R.top(k.id); assert.ok(y > 0 && y < 60 && (flat === 0 || flat === 1), k.id + ' has a top edge'); }
});
