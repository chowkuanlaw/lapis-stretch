const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const target = path.resolve(__dirname, '../src/shared');
fs.mkdirSync(target, { recursive: true });
for (const name of ['data.js', 'i18n.js']) {
  fs.copyFileSync(path.join(root, 'renderer', name), path.join(target, name));
}
console.log('Copied shared stretch data and translations into mobile/src/shared');
