#!/bin/bash
# Writes the week report (Mondays) or the month report (the 1st) into Apple Notes, folder "AMS Garmin".
# Usage: report.sh [week|month]   — without an argument the date decides; a report is written once per day.
PORT=7788
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAMPS="$HOME/Library/Application Support/AMS Garmin MCP/board"
mkdir -p "$STAMPS"
if [ -x /usr/local/bin/node ]; then NODE=/usr/local/bin/node
elif [ -x /opt/homebrew/bin/node ]; then NODE=/opt/homebrew/bin/node
else NODE="$(command -v node)"; fi

KINDS="$1"
if [ -z "$KINDS" ]; then
  [ "$(date +%u)" = "1" ] && KINDS="week"
  [ "$(date +%d)" = "01" ] && KINDS="$KINDS month"
fi
[ -n "$KINDS" ] || { echo "Not a Monday and not the 1st: nothing to report."; exit 0; }

if ! curl -sf "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
  nohup "$NODE" "$DIR/board/server.js" --port $PORT >> "$HOME/Library/Logs/AMS Garmin Board.log" 2>&1 &
  disown
  for _ in $(seq 1 50); do sleep 0.2; curl -sf "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1 && break; done
fi

for KIND in $KINDS; do
  STAMP="$STAMPS/report-$KIND-$(date +%F).done"
  [ -e "$STAMP" ] && [ -z "$1" ] && { echo "The $KIND report was already written today."; continue; }
  JSON="$(curl -sf --max-time 120 "http://127.0.0.1:$PORT/api/report?kind=$KIND")" || { echo "The board did not answer for the $KIND report."; continue; }
  TITLE="$(printf '%s' "$JSON" | "$NODE" -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);process.stdout.write(j.ok?j.title:"")})')"
  BODY="$(printf '%s' "$JSON" | "$NODE" -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);if(!j.ok)return;const esc=t=>t.replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));process.stdout.write("<h1>AMS Garmin · "+esc(j.title)+"</h1>"+j.text.split("\n").map(l=>"<div>"+esc(l)+"</div>").join(""))})')"
  [ -n "$TITLE" ] || { echo "The $KIND report came back empty."; continue; }
  osascript - "AMS Garmin · $TITLE" "$BODY" <<'APPLESCRIPT'
on run argv
  set noteTitle to item 1 of argv
  set noteBody to item 2 of argv
  tell application "Notes"
    if not (exists folder "AMS Garmin") then make new folder with properties {name:"AMS Garmin"}
    make new note at folder "AMS Garmin" with properties {name:noteTitle, body:noteBody}
  end tell
end run
APPLESCRIPT
  touch "$STAMP"
  echo "Wrote the $KIND report to Apple Notes: $TITLE"
done
