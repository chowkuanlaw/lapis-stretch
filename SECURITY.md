# Security

## Reporting a problem

Please report security issues privately through GitHub: open the **Security** tab of this
repository and choose **Report a vulnerability**. Please don't open a public issue for them.

## What Lapis does and doesn't do

- Lapis keeps everything on your computer, in `%APPDATA%\Lapis\state.json`: your settings,
  your chosen kuih, your collection and how many stretches and glasses of water you had each day.
  A copy from the previous day is kept as `state.bak.json` so a damaged file can be recovered.
  It has no accounts, analytics or tracking.
- **Reset my data** in Settings deletes the history, collection and badges, including the backup
  copy. The uninstaller asks whether to delete the whole `%APPDATA%\Lapis` folder (it never asks,
  or deletes anything, during an update).
- Its only network traffic is checking this repository's GitHub releases for updates (you can
  turn automatic checks off in Settings). Nothing about you is sent.
- To stay quiet in meetings it asks Windows, just before showing a reminder or a corner card (water,
  end of day and the like), whether an app is full screen or presenting (SHQueryUserNotificationState,
  called in-process through the koffi library) and whether Do not disturb is on (one read-only
  PowerShell command with a fixed script). It never uses the microphone or camera. Turning off
  "Stay quiet in meetings and presentations" stops both.
- To hide the desktop widget during full screen and presentations, it asks the first of those
  questions (no PowerShell) every 5 seconds. Turning off "Hide the widget in full screen" stops it.
- Its "time away counts as a break" feature reads only how long the keyboard and mouse have been
  idle and whether the screen is locked, never what you type or where you click.
- Updates are downloaded from this repository's GitHub releases over HTTPS and checked against
  the SHA-512 hash published with each release before they install.

## How the app is locked down

- Every window is sandboxed with context isolation and no Node.js access, and loads only Lapis's
  own pages from a private `lapis://app/` protocol that serves files from the app's `renderer`
  folder and nothing else.
- A strict Content Security Policy blocks remote scripts, network requests, plugins and frames.
- Windows can't open new windows, navigate away, embed webviews or download files, and every
  browser permission (camera, microphone, location, notifications...) is denied.
- The main process accepts messages only from Lapis's own pages, validates every value it
  receives, and reads back only known settings with the right types from its state file.
- Electron fuses turn off running as Node.js, `NODE_OPTIONS`, and the `--inspect` debugging
  flags; the installer also only loads its integrity-checked `app.asar`.
- Releases are built by GitHub Actions from this repository with least-privilege tokens and
  actions pinned to exact commits; each release lists SHA-256 checksums. Automatic tests (including
  how saved settings are read back) and a Windows start-up check must pass before anything is published.
- The state file is written to a temporary file and then swapped in, so an interrupted save can't
  leave a half-written file.

## Known limitations

- Some workplace security tools log or flag apps that start PowerShell. Lapis only runs the one
  read-only Do not disturb query above; turn off "Stay quiet in meetings and presentations" if
  your IT team prefers it doesn't.

- The Windows builds are not code-signed yet, so Windows SmartScreen may warn on first run and
  the updater can't check a publisher signature (it still checks the release hash).
