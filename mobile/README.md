# Lapis for iOS and Android

This is a mobile adaptation of Lapis built with Expo and React Native. It uses copies of the desktop stretch catalogue, English and Malay text, kuih unlock rules, and progress calculations from `../renderer/`. It has a phone layout for Today, Stretches, Progress, Your kuih, and Settings. Completed stretches, water counts, and settings are saved locally on the device.

## Run it

Use Node 22 or newer. From this directory:

```bash
npm ci
npm test
npm run typecheck
npm start
```

Scan the Expo QR code with a compatible iOS or Android device. A development build is recommended for testing notifications. Native builds require Xcode on macOS for iOS or an Android SDK for Android; Expo's EAS Build can build both platforms after you configure your own Apple and Google accounts and signing credentials. No signing credentials are stored here.

The app uses the local time zone. Turn on phone reminders in the first-run card or Settings and grant notification permission. The app schedules up to 60 upcoming local alerts to stay below iOS's pending notification limit. At the default interval this covers roughly two working days, so open Lapis each workday to refill them. The phone's power, Focus, and notification settings can delay or silence alerts. Working hours, workdays, lunch, interval, water reminders, snooze, and a 30-minute pause affect the schedule. The mobile app does not run a continuous background timer.

The mobile app starts with its own local history. It does not read the Windows `%APPDATA%\Lapis` file or sync data between devices. Desktop-only tray, always-on-top widget, meeting/full-screen detection, away detection, and Windows installer/Store behavior are outside this mobile version.

After changing `../renderer/data.js` or `../renderer/i18n.js`, run `npm run sync:shared` and commit the updated copies. Mascot PNGs are generated from the desktop drawings; after changing `../renderer/mascot.js`, run `npm run generate:kuih` and commit the updated images and `src/mascots.ts`. The committed copies let a mobile-only build bundle without reaching outside this project folder.
