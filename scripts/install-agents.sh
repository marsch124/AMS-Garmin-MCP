#!/bin/bash
# Installs (or with --remove removes) the two launch agents of the AMS Garmin Board:
#   com.ams.garmin.board.server  — starts the board server at login and keeps it running
#   com.ams.garmin.board.report  — Monday 07:30 the week report, the 1st at 07:35 the month report (into Apple Notes)
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGENTS="$HOME/Library/LaunchAgents"
LOG="$HOME/Library/Logs/AMS Garmin Board.log"
SERVER_LABEL="com.ams.garmin.board.server"
REPORT_LABEL="com.ams.garmin.board.report"
PORT=7788
if [ -x /usr/local/bin/node ]; then NODE=/usr/local/bin/node
elif [ -x /opt/homebrew/bin/node ]; then NODE=/opt/homebrew/bin/node
else NODE="$(command -v node)"; fi
UID_NUM="$(id -u)"

if [ "$1" = "--remove" ]; then
  for L in "$SERVER_LABEL" "$REPORT_LABEL"; do
    launchctl bootout "gui/$UID_NUM/$L" 2>/dev/null || true
    rm -f "$AGENTS/$L.plist"
    echo "Removed $L"
  done
  exit 0
fi

[ -n "$NODE" ] || { echo "Node is not installed."; exit 1; }
mkdir -p "$AGENTS" "$HOME/Library/Logs"
chmod +x "$DIR/scripts/report.sh" "$DIR/scripts/open-board.sh"

cat > "$AGENTS/$SERVER_LABEL.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$SERVER_LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE</string>
    <string>$DIR/board/server.js</string>
    <string>--port</string>
    <string>$PORT</string>
  </array>
  <key>WorkingDirectory</key><string>$DIR</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key>
  <dict><key>SuccessfulExit</key><false/></dict>
  <key>ThrottleInterval</key><integer>15</integer>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string></dict>
</dict>
</plist>
PLIST

cat > "$AGENTS/$REPORT_LABEL.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$REPORT_LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$DIR/scripts/report.sh</string>
  </array>
  <key>WorkingDirectory</key><string>$DIR</string>
  <key>StartCalendarInterval</key>
  <array>
    <dict><key>Weekday</key><integer>1</integer><key>Hour</key><integer>7</integer><key>Minute</key><integer>30</integer></dict>
    <dict><key>Day</key><integer>1</integer><key>Hour</key><integer>7</integer><key>Minute</key><integer>35</integer></dict>
  </array>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string></dict>
</dict>
</plist>
PLIST

# Hand the port to the agent: stop a board server started by hand (the Desktop icon) first.
OLD="$(lsof -ti tcp:$PORT -sTCP:LISTEN 2>/dev/null || true)"
if [ -n "$OLD" ]; then kill $OLD 2>/dev/null || true; sleep 1; fi

for L in "$SERVER_LABEL" "$REPORT_LABEL"; do
  launchctl bootout "gui/$UID_NUM/$L" 2>/dev/null || true
  launchctl bootstrap "gui/$UID_NUM" "$AGENTS/$L.plist"
  echo "Installed $L"
done
for _ in $(seq 1 25); do
  sleep 0.2
  curl -sf "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1 && { echo "The board server is running."; exit 0; }
done
echo "The board server did not answer yet; see $LOG"
