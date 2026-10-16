// Replaces Electron's icon and file details in Lapis.exe.
// Usage: node set-exe-icon.mjs <Lapis.exe> <icon.ico>   (needs the resedit package)
import * as ResEdit from 'resedit';
import * as PELibrary from 'pe-library';
import fs from 'fs';

const [exe, ico] = process.argv.slice(2);
if (!exe || !ico) { console.error('Usage: node set-exe-icon.mjs <exe> <ico>'); process.exit(1); }

const exeObj = PELibrary.NtExecutable.from(fs.readFileSync(exe), { ignoreCert: true });
const res = PELibrary.NtExecutableResource.from(exeObj);

const iconFile = ResEdit.Data.IconFile.from(fs.readFileSync(ico));
const group = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries)[0];
ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, group.id, group.lang, iconFile.icons.map(i => i.data));

const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0];
const lang = vi.getAllLanguagesForStringValues()[0] || { lang: 1033, codepage: 1200 };
vi.setStringValues(lang, {
  ProductName: 'Lapis', FileDescription: 'Lapis stretch reminder', InternalName: 'Lapis',
  OriginalFilename: 'Lapis.exe', CompanyName: '', LegalCopyright: ''
});
vi.setFileVersion(1, 0, 0, 0, lang.lang);
vi.setProductVersion(1, 0, 0, 0, lang.lang);
vi.outputToResourceEntries(res.entries);

res.outputResource(exeObj);
fs.writeFileSync(exe, Buffer.from(exeObj.generate()));
console.log('Updated', exe);
