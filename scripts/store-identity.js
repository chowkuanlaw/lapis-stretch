'use strict';
// Puts the Partner Center identity into package.json for the Store build only (run by .github/workflows/store.yml).
// The values come from the workflow run, never from the source code, and are checked before use.
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'package.json');
const { ID_NAME = '', ID_PUB = '', ID_PUB_NAME = '', ID_DISPLAY = '' } = process.env;
const checks = [
  ['identity name', ID_NAME, /^[A-Za-z0-9][A-Za-z0-9.-]{2,49}$/],
  ['publisher', ID_PUB, /^CN=[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i],
  ['publisher display name', ID_PUB_NAME, /^[^<>"&]{1,256}$/],
  ['display name', ID_DISPLAY, /^[^<>"&]{1,256}$/]
];
for (const [what, v, re] of checks) if (!re.test(v.trim())) { console.error(`Missing or invalid ${what}. Give it when starting the run.`); process.exit(1); }
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
Object.assign(pkg.build.appx, {
  identityName: ID_NAME.trim(), publisher: ID_PUB.trim(), publisherDisplayName: ID_PUB_NAME.trim(), displayName: ID_DISPLAY.trim()
});
fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
console.log('Store identity filled in for', pkg.build.appx.displayName);
