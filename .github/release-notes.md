Lapis, a desk-stretch reminder for Windows.

**Install:** download `Lapis-win-x64.zip`, unzip it anywhere, and run `Lapis.exe`. The app isn't code-signed, so Windows may show "Windows protected your PC" the first time: click **More info**, then **Run anyway**.

**What's in it**
- Pop-up reminder card every 20 minutes (15–60 configurable) with Start, Snooze, Skip and a timer
- Desktop countdown widget and a tray icon
- Nine desk stretches with "How to" guides, plus a daily and weekly tally
- Timer restarts after 5 minutes away, or when you lock or sleep your PC
- No tracking; settings and counts stay in `%APPDATA%\Lapis\state.json`. The only network request is an optional update check, off by default

This zip was built by GitHub Actions from the source in this repository (see `.github/workflows/release.yml`), using the official Electron Windows x64 build verified against Electron's published checksums.
