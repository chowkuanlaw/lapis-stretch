# Lapis

[![Latest release](https://img.shields.io/github/v/release/chowkuanlaw/lapis-stretch?label=download)](https://github.com/chowkuanlaw/lapis-stretch/releases/latest) [![Release build](https://github.com/chowkuanlaw/lapis-stretch/actions/workflows/release.yml/badge.svg)](https://github.com/chowkuanlaw/lapis-stretch/actions/workflows/release.yml) [![MIT licence](https://img.shields.io/badge/licence-MIT-2A7F4F)](LICENSE) ![Windows 10 and 11](https://img.shields.io/badge/Windows-10%20%7C%2011-C92A62)

A small Windows desktop app that reminds you to stretch while you work. Every 20 minutes, Lapis (a kuih lapis with arms and legs, or any of 19 other Malaysian kuih you pick) pops up in the corner of your screen with one quick desk stretch, a timer, and a tally of how many you've done today.

![The Lapis desktop widget and pop-up reminder](docs/widget-and-reminder.png)

## What it does

- **Pop-up reminder.** A card slides up in the bottom-right corner, above whatever app you're in, without stealing focus. Start, Snooze, Skip or pick a different stretch. It chimes, and for one-side-at-a-time stretches it chimes again when to switch sides.
- **Desktop widget.** A small countdown card that stays on top of your windows. Drag it anywhere.
- **Tray icon.** Left-click to open Lapis, right-click to pause or quit. Closing the window keeps reminders running.
- **A tidy main window.** A sidebar with five pages: **Today** (countdown, up next, today's tally, what's coming up), **Stretches**, **Your kuih**, **Progress** (week chart, best day, streak) and **Settings**.
- **Quick setup on first launch.** Say hello, pick your kuih, choose how often, done.
- **Nine stretches.** Chin tucks, neck side stretch, thoracic extension, shoulder rolls, seated twist, wrist stretch, a 20-20-20 eye break, stand and reach, and a 2-minute walkaround every few rounds. Each has a "How to" guide.
- **Knows when you're away.** After 5 minutes of no keyboard or mouse activity, or when you lock or sleep your PC, the timer restarts so you're not nagged the moment you sit back down.
- **Settings.** Remind every 15–60 minutes, snooze 5–15 minutes, chime on or off, widget on or off, optional Windows notification and start with Windows.
- **Pick your kuih.** Choose from 20 Malaysian kuih: Malay, Chinese & Nyonya, Indian, and Sabah & Sarawak. Your kuih shows up on reminders, the desktop widget, the stretch list and the tray icon.
- **Keeps itself up to date.** New versions download in the background; click **Restart to update** when it suits you.

![The Lapis main window: the Today page](docs/main-window.png)

![First-launch setup: pick your kuih](docs/welcome.png)

![The 20 kuih you can choose from](docs/kuih-friends.png)

## Install

1. Download **`Lapis-Setup-<version>.exe`** from the [latest release](../../releases/latest).
2. Run it. Lapis installs just for you (no admin rights needed), adds itself to the Start menu and opens.

The app isn't code-signed, so Windows may show "Windows protected your PC" the first time. Click **More info**, then **Run anyway**.

**Updates are automatic.** Lapis checks for a new version when it starts and once a day, downloads it in the background, and shows **Restart to update** in the Lapis window (and a Windows notification). If you don't restart, the update installs the next time you quit Lapis. Your settings and stretch history are kept. You can turn this off in Settings, and **Check now** checks on demand.

**Portable copy:** if you'd rather not install anything, download `Lapis-win-x64.zip`, unzip it anywhere and run `Lapis.exe`. The portable copy tells you when a new version is out, but you replace the folder yourself.

To uninstall, go to Windows **Settings → Apps → Installed apps → Lapis → Uninstall**. Your stretch history in `%APPDATA%\Lapis` is left in place; delete that folder too if you want it gone.

## Privacy

Lapis has no analytics, no accounts and no tracking. Fonts and images are bundled, and every window runs under a content security policy that only allows the app's own files. The only thing it saves is your settings and stretch counts per day, in `%APPDATA%\Lapis\state.json` on your own PC.

The only network traffic is the update check against this repository's GitHub releases: when Lapis starts, once a day, and when you click **Check now**. It sends nothing about you or your stretches, just the standard request any download makes. Turn off **Update automatically** in Settings and Lapis only goes online when you click **Check now**.

See [SECURITY.md](SECURITY.md) for how the app is locked down and how to report a security problem.

## Build from source

Run it in development (any OS, Node 22):

```bash
npm ci
npm start
```

Build the installer (on Windows):

```bash
npm ci
npm run dist:installer
# -> dist/installer/Lapis-Setup-<version>.exe and latest.yml
```

Build the portable zip (on Linux, macOS or WSL; needs `curl`, `unzip`, `zip`, `node` and `npm`):

```bash
./scripts/build-win.sh
# -> dist/Lapis/Lapis.exe and dist/Lapis-win-x64.zip
```

### Releasing

Releases are built by GitHub Actions (`.github/workflows/release.yml`) from the source, never on someone's PC:

1. Bump `version` in `package.json` and add a line to `CHANGELOG.md`.
2. Push a matching tag (`v1.1.1`), or open the Actions tab, pick **Release**, click **Run workflow** and enter the tag.

The workflow refuses to run if the tag doesn't match `package.json`. It builds the installer on Windows and the portable zip on Linux, then publishes both. Installed copies of Lapis pick up the new release on their next check.

## Project layout

```
main.js            timer, state, tray, updates and the app windows (runs in the main process)
preload.js         the small bridge the windows use to talk to main.js
renderer/          the UI: index.html, app.css, app.js, the mascot drawing, the stretch list, fonts
assets/            app and tray icons
scripts/           portable build script, exe icon and Electron fuses
package.json       app details, plus the installer settings under "build"
```

## Feedback

Found a bug or have a stretch you'd like Lapis to suggest? [Open an issue](../../issues/new/choose).

## Licence

Lapis is released under the [MIT licence](LICENSE): you're free to use, change and share it, including in your own projects, as long as you keep the copyright notice.

## Credits

Fonts: [Baloo 2](https://github.com/EkType/Baloo2), [Figtree](https://github.com/erikdkennedy/figtree) and [DM Mono](https://github.com/googlefonts/dm-mono), under the SIL Open Font License (see `renderer/fonts/LICENSES.txt`). Built with [Electron](https://www.electronjs.org/).

Stretch guidance is general wellness information, not medical advice. Stop any stretch that hurts.
