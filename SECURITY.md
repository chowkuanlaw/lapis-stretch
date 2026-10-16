# Security

## Reporting a problem

Please report security issues privately through GitHub: open the **Security** tab of this
repository and choose **Report a vulnerability**. Please don't open a public issue for them.

## What Lapis does and doesn't do

- Lapis keeps everything on your computer, in `%APPDATA%\Lapis\state.json`: your settings,
  your chosen kuih and how many stretches you did each day. It has no accounts, analytics or tracking.
- Its only network traffic is checking this repository's GitHub releases for updates (you can
  turn automatic checks off in Settings). Nothing about you is sent.
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
  actions pinned to exact commits; each release lists SHA-256 checksums.

## Known limitations

- The Windows builds are not code-signed yet, so Windows SmartScreen may warn on first run and
  the updater can't check a publisher signature (it still checks the release hash).
