'use strict';
// Guards for the click handling in renderer/app.js, which routes clicks by data-* attributes.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'app.js'), 'utf8');

test('only the +/- buttons carry data-step, so the welcome screen options stay clickable', () => {
  // 1.12.0 fix: the welcome screen's step panels used data-step too, and every click inside them
  // was taken as a +/- press, so its language, kuih and settings buttons did nothing.
  const tags = [...src.matchAll(/<(\w+)[^<>]*\bdata-step=/g)].map(m => m[1]);
  assert.ok(tags.length > 0, 'the daily goal +/- buttons should use data-step');
  assert.deepEqual([...new Set(tags)], ['button']);
  assert.match(src, /closest\('button\[data-step\]\[data-d\]'\)/);
});

test('every welcome screen step has its own panel', () => {
  const steps = [...src.matchAll(/class="ob-body[^"]*" data-obstep="(\d)"/g)].map(m => +m[1]);
  assert.deepEqual(steps, [0, 1, 2, 3, 4]);
});
