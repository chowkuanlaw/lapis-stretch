# Changelog

## 1.6.0 (2026-10-16)

- **Working hours.** Reminders only on your working days and hours (Monday to Friday, 9:00 am to 6:00 pm by default), with lunch (1:00 to 2:00 pm) skipped. Outside them Lapis rests and the widget shows when it's back. All of it can be changed in Settings.
- **Quiet in meetings and presentations.** While an app is full screen or presenting, or Windows Do not disturb is on, the reminder waits and comes 2 minutes after you're done. No microphone or camera checks.
- **Water reminders.** Every hour (you choose), your kuih holds up a glass of water; "Done, I drank" counts it toward your 8 glasses a day. New artwork of every kuih holding and drinking a glass.
- **Daily goal** of 8 stretches (you choose), shown on Today and the widget, and a **Friday summary** of your week 30 minutes before the end of your last working day.
- **Kuih collection.** New users start with Kuih Lapis, Ang Ku Kueh, Murukku and Kek Lapis Sarawak and unlock the other 16 by stretching, with each kuih's rule and progress shown on Your kuih. Existing users keep what their history has already earned and the kuih they use now. Turn off Collect kuih in Settings to have all 20 at once. There's also a place to enter a secret code.
- **Festive outfits.** For Hari Raya Aidilfitri, Chinese New Year, Deepavali, Pesta Kaamatan and Hari Gawai, every kuih wears that festival's traditional outfit for the 4 days before and on the day itself.
- **Bahasa Melayu.** Choose English or Bahasa Melayu on the welcome screen or in Settings; every screen, reminder, the tray menu and notifications follow it.
- Streaks now count working days where you reach your daily goal; days off don't break them.

## 1.5.2 (2026-10-16)

- **The countdown carries on after a quick restart.** If Lapis is back within 5 minutes (after "Restart to update", or quitting and reopening), it picks up the countdown where it left off instead of starting a fresh 20 minutes. After a longer break, such as overnight, it still starts fresh.
- If a stretch was already due, it pops up again right after the restart.
- Updating from the tray menu while the Lapis window is closed no longer opens the window afterwards.

## 1.5.1 (2026-10-16)

Security hardening. Nothing changes in how Lapis looks or works, and your settings and history are kept.

- Updated Electron to 44.8.0 for the latest Chromium security fixes.
- The app's pages now load from a private `lapis://app/` address that serves only Lapis's own files, instead of `file://`.
- Every browser permission (camera, microphone, location, notifications...) is denied, and windows can't navigate away, open new windows, embed webviews or download files.
- The main process only accepts messages from Lapis's own pages, and the saved settings file is checked field by field when it's loaded.
- Tighter Content Security Policy: no network requests, plugins, frames or workers from the pages.
- Electron fuses: Lapis.exe can no longer be run as Node.js or opened for debugging with `--inspect` or `NODE_OPTIONS`; the installer also checks the integrity of its app files.
- Release pipeline: least-privilege tokens, actions pinned to exact commits, a Windows start-up check before publishing, and Dependabot for security updates.
- Added SECURITY.md.

## 1.5.0 (2026-10-16)

- The surprise hidden in your kuih now has four versions, one for each kuih group: Malay, Chinese & Nyonya, Indian, and Sabah & Sarawak. Try a different kuih to find them all.

## 1.4.0 (2026-10-16)

- A little surprise is hidden in your kuih. Be quick with it.
- Clicking your kuih on the Today timer or the desktop widget now gives it a small squish.

## 1.3.0 (2026-10-16)

- **New main window:** a sidebar with five pages instead of one long scrolling screen.
  - **Today:** countdown, the next stretch, today's tally with the week chart, and the next four stretches coming up.
  - **Stretches:** all nine stretches with how to do them; click one to do it now.
  - **Your kuih:** the 20-kuih picker with a large preview of your choice.
  - **Progress:** today, last 7 days, best day and your streak, plus today's stretches by type.
  - **Settings:** grouped into Reminders, Alerts, Desktop, When you step away, Updates and About.
- Reminder status and Pause live in the sidebar; Today shows a red dot when a stretch is waiting.
- **First-launch setup** for new installs: welcome, pick your kuih, choose how often, done. Existing users skip it; Settings > About > "Show the welcome again" reopens it.
- Narrow windows collapse the sidebar to icons.

## 1.2.0 (2026-10-16)

- **Your kuih:** pick your stretch buddy from 20 Malaysian kuih in four groups: Malay (Kuih Lapis, Onde-onde, Seri Muka, Karipap, Kuih Bahulu), Chinese & Nyonya (Ang Ku Kueh, Kuih Kapit, Huat Kueh, Kuih Bulan, Tart Nenas), Indian (Murukku, Ladoo, Putu Mayam, Vadai, Jalebi) and Sabah & Sarawak (Kek Lapis Sarawak, Kuih Celorot, Pinjaram, Kuih Cincin, Hinompuka).
- Your kuih appears on the reminder card, the desktop widget, the main window, the stretch list and the tray icon. Every kuih does every stretch.
- Kuih Lapis stays the default; your choice is saved with your settings.

## 1.1.0 (2026-10-16)

- New installer, `Lapis-Setup-<version>.exe`: per-user, no admin rights, Start menu entry and a proper uninstall.
- Installed copies update themselves: Lapis checks when it starts and once a day, downloads in the background, then shows **Restart to update** (in the window, the tray menu and a Windows notification). Ignored updates install the next time you quit.
- **Update automatically** is on by default and replaces the old "Check for updates" switch. **Check now** still checks on demand.
- The portable zip is still available; it shows a Download link when a new version is out.
- Release workflow builds the installer on Windows and refuses to publish if the tag doesn't match `package.json`.

## 1.0.3 (2026-10-16)

- Optional update check, off by default: Settings > Check for updates, or Check now. Shows a Download button when a newer release is out; never downloads anything by itself.
- The current version is shown in Settings.

## 1.0.1 (2026-10-16)

- Released under the MIT licence; the licence now ships inside the app folder.
- `Lapis.exe` file details now show the app version.
- Release builds use current GitHub Actions versions.

## 1.0.0 (2026-10-16)

- First release: pop-up stretch reminders, desktop countdown widget, tray icon, nine desk stretches with how-to guides, daily and weekly tally, away-from-desk timer reset, and start with Windows.
