#!/usr/bin/env bash
# Builds the Windows x64 app into dist/Lapis and dist/Lapis-win-x64.zip.
# Runs on Linux, macOS or WSL. Needs: curl, unzip, zip, node and npm.
#   ./scripts/build-win.sh
#   ELECTRON_VERSION=44.8.0 ./scripts/build-win.sh
set -euo pipefail

ELECTRON_VERSION="${ELECTRON_VERSION:-44.8.0}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/dist"
CACHE="$DIST/.cache"
OUT="$DIST/Lapis"
ZIP="electron-v${ELECTRON_VERSION}-win32-x64.zip"
BASE="https://github.com/electron/electron/releases/download/v${ELECTRON_VERSION}"

sha256() { if command -v sha256sum >/dev/null; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi; }

mkdir -p "$CACHE"
echo "Downloading Electron ${ELECTRON_VERSION} for Windows x64..."
[ -f "$CACHE/$ZIP" ] || curl -fsSL -o "$CACHE/$ZIP" "$BASE/$ZIP"
curl -fsSL -o "$CACHE/SHASUMS256.txt" "$BASE/SHASUMS256.txt"
want="$(grep -E " \*?${ZIP}\$" "$CACHE/SHASUMS256.txt" | cut -d' ' -f1)"
have="$(sha256 "$CACHE/$ZIP")"
if [ -z "$want" ] || [ "$want" != "$have" ]; then echo "Checksum mismatch for $ZIP" >&2; exit 1; fi

echo "Assembling dist/Lapis..."
rm -rf "$OUT" && mkdir -p "$OUT"
unzip -q "$CACHE/$ZIP" -d "$OUT"
mv "$OUT/electron.exe" "$OUT/Lapis.exe"
rm -f "$OUT/resources/default_app.asar"
APP="$OUT/resources/app"
mkdir -p "$APP"
cp -r "$ROOT/main.js" "$ROOT/quiet.js" "$ROOT/preload.js" "$ROOT/package.json" "$ROOT/LICENSE" "$ROOT/renderer" "$ROOT/assets" "$APP/"
cp "$ROOT/scripts/README.txt" "$OUT/README.txt"

echo "Adding the Windows libraries Lapis uses (from package-lock.json)..."
cp "$ROOT/package-lock.json" "$APP/"
(cd "$APP" && npm ci --omit=dev --ignore-scripts --os=win32 --cpu=x64 --no-audit --no-fund --silent)
rm -f "$APP/package-lock.json"
find "$APP/node_modules" -type d -empty -delete
test -f "$APP/node_modules/@koromix/koffi-win32-x64/win32_x64/koffi.node" || { echo "Missing koffi for Windows" >&2; exit 1; }

echo "Setting the Lapis icon and file details on Lapis.exe..."
if [ ! -d "$CACHE/node_modules/resedit" ] || [ ! -d "$CACHE/node_modules/@electron/fuses" ]; then
  (cd "$CACHE" && echo '{"private":true}' > package.json && npm install --silent --no-audit --no-fund --ignore-scripts resedit@2.0.3 @electron/fuses@1.8.0)
fi
cp "$ROOT/scripts/set-exe-icon.mjs" "$ROOT/scripts/set-fuses.mjs" "$CACHE/"
VERSION="$(node -p "require('$ROOT/package.json').version")"
node "$CACHE/set-exe-icon.mjs" "$OUT/Lapis.exe" "$ROOT/assets/icon.ico" "$VERSION"

echo "Locking down Electron features Lapis doesn't use..."
node "$CACHE/set-fuses.mjs" "$OUT/Lapis.exe"

echo "Zipping..."
(cd "$DIST" && rm -f Lapis-win-x64.zip && zip -qr -9 Lapis-win-x64.zip Lapis)
echo "Done: dist/Lapis/Lapis.exe and dist/Lapis-win-x64.zip"
