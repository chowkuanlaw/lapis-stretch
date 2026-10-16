# Lapis

[![Latest release](https://img.shields.io/github/v/release/chowkuanlaw/lapis-stretch?label=download)](https://github.com/chowkuanlaw/lapis-stretch/releases/latest) [![Release build](https://github.com/chowkuanlaw/lapis-stretch/actions/workflows/release.yml/badge.svg)](https://github.com/chowkuanlaw/lapis-stretch/actions/workflows/release.yml) [![MIT licence](https://img.shields.io/badge/licence-MIT-2A7F4F)](LICENSE) ![Windows 10 and 11](https://img.shields.io/badge/Windows-10%20%7C%2011-C92A62)

A small Windows desktop app that reminds you to stretch while you work. Every 20 minutes, Lapis (a kuih lapis with arms and legs) pops up in the corner of your screen with one quick desk stretch, a timer, and a tally of how many you've done today.

![The Lapis desktop widget and pop-up reminder](docs/widget-and-reminder.png)

## What it does

- **Pop-up reminder.** A card slides up in the bottom-right corner, above whatever app you're in, without stealing focus. Start, Snooze, Skip or pick a different stretch. It chimes, and for one-side-at-a-time stretches it chimes again when to switch sides.
- **Desktop widget.** A small countdown card that stays on top of your windows. Drag it anywhere.
- **Tray icon.** Left-click to open Lapis, right-click to pause or quit. Closing the window keeps reminders running.
- **Nine stretches.** Chin tucks, neck side stretch, thoracic extension, shoulder rolls, seated twist, wrist stretch, a 20-20-20 eye break, stand and reach, and a 2-minute walkaround every few rounds. Each has a "How to" guide.
- **Knows when you're away.** After 5 minutes of no keyboard or mouse activity, or when you lock or sleep your PC, the timer restarts so you're not nagged the moment you sit back down.
- **Settings.** Remind every 15–60 minutes, snooze 5–15 minutes, chime on or off, widget on or off, optional Windows notification, start with Windows, and an optional daily update check.

![The Lapis main window](docs/main-window.png)

## Install

1. Download `Lapis-win-x64.zip` from the [latest release](../../releases/latest).
2. Unzip it anywhere you like, for example `C:\Users\<you>\tools\Lapis`.
3. Run `Lapis.exe`.

The app isn't code-signed, so Windows may show "Windows protected your PC" the first time. Click **More info**, then **Run anyway**.

To uninstall, quit Lapis from the tray menu, turn off **Start with Windows** first if you want, then delete the folder. You can also delete `%APPDATA%\Lapis` and the Lapis entry in the Start menu.

## Privacy

Lapis has no analytics, no accounts and no tracking. Fonts and images are bundled, and every window runs under a content security policy that only allows the app's own files. The only thing it saves is your settings and stretch counts per day, in `%APPDATA%\Lapis\state.json` on your own PC.

The one network request Lapis can make is the update check, and it's **off by default**. If you turn on **Check for updates** in Settings (or click **Check now**), Lapis asks GitHub's public API for the latest release of this repository, at most once a day. It sends nothing about you or your stretches; if a newer version exists, Lapis shows a **Download** button that opens the releases page. It never downloads or installs anything by itself.

## Build from source

Lapis is plain Electron with no build step or npm dependencies for the app itself.

Run it in development (any OS):

```bash
npm install --no-save electron@44.5.1
npx electron .
```

Build the Windows app and zip (on Linux, macOS or WSL; needs `curl`, `unzip`, `zip`, `node` and `npm`):

```bash
./scripts/build-win.sh
# -> dist/Lapis/Lapis.exe and dist/Lapis-win-x64.zip
```

The script downloads the official Electron Windows build, checks it against Electron's published SHA-256 checksums, copies the app in, and sets the Lapis icon on `Lapis.exe`.

Releases are built the same way by GitHub Actions (`.github/workflows/release.yml`): push a tag such as `v1.0.1`, or open the Actions tab, pick **Release** and click **Run workflow** with the new version. It builds the zip from the source and attaches it to a new release.

## Project layout

```
main.js            timer, state, tray, and the three windows (runs in the main process)
preload.js         the small bridge the windows use to talk to main.js
renderer/          the UI: index.html, app.css, app.js, the mascot drawing, the stretch list, fonts
assets/            app and tray icons
scripts/           Windows build script
```

## Feedback

Found a bug or have a stretch you'd like Lapis to suggest? [Open an issue](../../issues/new/choose).

## Licence

Lapis is released under the [MIT licence](LICENSE): you're free to use, change and share it, including in your own projects, as long as you keep the copyright notice.

## Credits

Fonts: [Baloo 2](https://github.com/EkType/Baloo2), [Figtree](https://github.com/erikdkennedy/figtree) and [DM Mono](https://github.com/googlefonts/dm-mono), under the SIL Open Font License (see `renderer/fonts/LICENSES.txt`). Built with [Electron](https://www.electronjs.org/).

Stretch guidance is general wellness information, not medical advice. Stop any stretch that hurts.
