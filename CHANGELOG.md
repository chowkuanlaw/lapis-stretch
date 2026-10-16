# Changelog

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
