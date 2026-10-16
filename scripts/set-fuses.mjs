// Turns off Electron features Lapis never uses, so Lapis.exe can't be reused as a general
// Node.js runtime or debugged/injected through command-line flags or environment variables.
//   node set-fuses.mjs path/to/Lapis.exe
import { flipFuses, FuseVersion, FuseV1Options } from '@electron/fuses';

const exe = process.argv[2];
if (!exe) { console.error('usage: node set-fuses.mjs <Lapis.exe>'); process.exit(1); }
await flipFuses(exe, {
  version: FuseVersion.V1,
  [FuseV1Options.RunAsNode]: false,
  [FuseV1Options.EnableCookieEncryption]: true,
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
  [FuseV1Options.EnableNodeCliInspectArguments]: false,
  [FuseV1Options.GrantFileProtocolExtraPrivileges]: false
});
console.log('Fuses set on', exe);
