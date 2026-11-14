Lapis, a desk-stretch reminder for Windows.

**Easiest:** get it free from the [Microsoft Store](https://apps.microsoft.com/detail/9nwmhw1373t4), signed by Microsoft and updated through the Store.

**Install:** download **`Lapis-Setup-<version>.exe`** and run it. It installs just for you (no admin rights needed), adds Lapis to the Start menu, and opens it. From then on Lapis keeps itself up to date: it checks for new versions when it starts and once a day, downloads them in the background, and shows **Restart to update**.

The app isn't code-signed, so Windows may show "Windows protected your PC" the first time: click **More info**, then **Run anyway**.

**Prefer a portable copy?** Download `Lapis-win-x64.zip`, unzip it anywhere and run `Lapis.exe`. The portable copy tells you when an update is out but doesn't install it by itself.

**What's in it**
- Pop-up reminder card every 20 minutes (15–60 configurable) with Start, Snooze, Skip and a timer
- Desktop countdown widget and a tray icon
- Thirteen desk stretches with "How to" guides, plus a daily and weekly tally; switch off any you can't do, and your kuih acts out every one
- 28 Malaysian kuih as 3D characters you can drag to spin (or the classic flat drawings, if you prefer)
- English, Bahasa Melayu, Chinese and Tamil
- Timer restarts after 5 minutes away, or when you lock or sleep your PC
- No tracking; settings and counts stay on your PC in `%APPDATA%\Lapis\state.json`. The only network traffic is the update check, which you can turn off in Settings

Built by GitHub Actions from the source in this repository (see `.github/workflows/release.yml`). `latest.yml` and the `.blockmap` file are what installed copies of Lapis use to update themselves.
