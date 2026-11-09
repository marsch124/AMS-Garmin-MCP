#!/bin/bash
# Builds ~/Applications/AMS Garmin Board.app (a tiny launcher) and a Desktop alias.
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NAME="AMS Garmin Board"
DEST="$HOME/Applications"
APP="$DEST/$NAME.app"
ICON_SRC="$HOME/Documents/01 Leisure/30 App Development/AMS Icon Library/png/app-icon/heart-1024.png"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

chmod +x "$DIR/scripts/open-board.sh"
echo "do shell script \"/bin/bash \" & quoted form of \"$DIR/scripts/open-board.sh\"" > "$TMP/launcher.applescript"
osacompile -o "$TMP/$NAME.app" "$TMP/launcher.applescript"
echo "Compiled launcher."

RES="$TMP/$NAME.app/Contents/Resources"
IS="$TMP/icon.iconset"; mkdir -p "$IS"
for s in 16 32 64 128 256 512; do
  sips -z $s $s "$ICON_SRC" --out "$IS/icon_${s}x${s}.png" >/dev/null
  sips -z $((s*2)) $((s*2)) "$ICON_SRC" --out "$IS/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$IS" -o "$RES/applet.icns"
rm -f "$RES/Assets.car"
PL="$TMP/$NAME.app/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Delete :CFBundleIconName" "$PL" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :CFBundleIdentifier string com.ams.garmin.board" "$PL" 2>/dev/null \
  || /usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier com.ams.garmin.board" "$PL"
/usr/libexec/PlistBuddy -c "Add :LSUIElement bool true" "$PL" 2>/dev/null \
  || /usr/libexec/PlistBuddy -c "Set :LSUIElement true" "$PL"
xattr -cr "$TMP/$NAME.app"
codesign --force --deep --sign - "$TMP/$NAME.app"
echo "Icon and settings done, signed."

mkdir -p "$DEST"
rm -rf "$APP"   # only the older copy of this one app
mv "$TMP/$NAME.app" "$APP"
echo "Installed: $APP"

if [ ! -e "$HOME/Desktop/$NAME" ]; then
  osascript -e "tell application \"Finder\" to make new alias file at (path to desktop folder) to (POSIX file \"$APP\") with properties {name:\"$NAME\"}" >/dev/null
  echo "Desktop alias created."
else
  echo "Desktop alias already exists."
fi
