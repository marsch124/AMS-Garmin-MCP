#!/bin/bash
# Opens the AMS Garmin Board: starts its small local server if needed, then opens the page.
PORT=7788
if [ -x /usr/local/bin/node ]; then NODE=/usr/local/bin/node
elif [ -x /opt/homebrew/bin/node ]; then NODE=/opt/homebrew/bin/node
else NODE="$(command -v node)"; fi
if [ -z "$NODE" ]; then
  osascript -e 'display dialog "The Garmin Board needs Node, and it is not installed on this Mac. Please install Node first." buttons {"OK"} default button "OK" with icon caution'
  exit 1
fi
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if ! curl -sf "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
  mkdir -p "$HOME/Library/Logs"
  nohup "$NODE" "$DIR/board/server.js" --port $PORT >> "$HOME/Library/Logs/AMS Garmin Board.log" 2>&1 &
  disown
  for _ in $(seq 1 25); do
    sleep 0.2
    curl -sf "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1 && break
  done
fi
open "http://127.0.0.1:$PORT/"
