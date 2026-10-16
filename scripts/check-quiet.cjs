// Run on Windows (the release workflow does this): checks that the two "quiet in meetings"
// checks in quiet.js work on a real machine. Fails only if the full-screen check can't run.
const QUIET = require('../quiet.js');
(async () => {
  const state = QUIET.queryState();
  console.log('SHQueryUserNotificationState:', state, '(5 = accepts notifications)');
  const mode = await QUIET.notificationMode();
  console.log('ToastNotificationManager.NotificationMode:', mode, mode === -1 ? '(not readable here: Lapis treats Do not disturb as off)' : '');
  if (!(Number.isInteger(state) && state >= 1 && state <= 7)) { console.error('Full-screen check failed'); process.exit(1); }
})();
