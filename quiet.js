'use strict';
/*
 * "Stay quiet in meetings and presentations" (Windows only). No microphone or camera checks.
 *   fullScreenBusy():  an app is full screen or presenting. Uses SHQueryUserNotificationState
 *                      from shell32.dll, called in-process through koffi.
 *   doNotDisturbOn():  Windows Do not disturb is on. Reads ToastNotificationManager.NotificationMode
 *                      with one read-only PowerShell command.
 * Anything that fails returns false, so the reminder simply shows as usual.
 */
const path = require('path');
const { execFile } = require('child_process');

// QUNS_BUSY, QUNS_RUNNING_D3D_FULL_SCREEN, QUNS_PRESENTATION_MODE, QUNS_APP
const BUSY_STATES = [2, 3, 4, 7];
let shQuery;
function queryState() {
  if (process.platform !== 'win32') return null;
  if (shQuery === undefined) {
    try {
      const koffi = require('koffi');
      shQuery = koffi.load('shell32.dll').func('long __stdcall SHQueryUserNotificationState(_Out_ int *state)');
    } catch (e) { shQuery = null; }
  }
  if (!shQuery) return null;
  try { const out = [0]; return shQuery(out) === 0 ? out[0] : null; } catch (e) { return null; }
}
const fullScreenBusy = () => BUSY_STATES.includes(queryState());

const PS_EXE = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
const DND_PS = '$m=-1;try{$null=[Windows.UI.Notifications.ToastNotificationManager,Windows.UI.Notifications,ContentType=WindowsRuntime];$m=[int][Windows.UI.Notifications.ToastNotificationManager]::GetDefault().NotificationMode}catch{};$m';
// Resolves to the NotificationMode number (0 off, 1 priority only, 2 alarms only), or -1 if it can't be read.
function notificationMode() {
  return new Promise(res => {
    if (process.platform !== 'win32') return res(-1);
    try {
      execFile(PS_EXE, ['-NoProfile', '-NonInteractive', '-Command', DND_PS], { windowsHide: true, timeout: 10000 },
        (err, out) => { const n = Number(String(out).trim()); res(err || !Number.isInteger(n) ? -1 : n); });
    } catch (e) { res(-1); }
  });
}
const doNotDisturbOn = () => notificationMode().then(m => m === 1 || m === 2);

module.exports = { fullScreenBusy, doNotDisturbOn, queryState, notificationMode };
