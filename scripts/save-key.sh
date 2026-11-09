#!/bin/bash
# AMS Garmin — asks for the Garmin Personal API key in a Mac dialog and saves it
# where the server reads it. The key never passes through the chat.
set -e
DIR="$HOME/Library/Application Support/AMS Garmin MCP"
KEY_FILE="$DIR/api-key"
TOKEN_FILE="$DIR/token.json"

KEY=$(osascript <<'APPLESCRIPT'
with timeout of 43200 seconds
tell application "System Events"
  activate
  set answer to display dialog "Paste your Garmin Personal API key.

Create one at connect.garmin.com → Settings → Personal API Key. It is shown only once." default answer "" with hidden answer with title "AMS Garmin" buttons {"Cancel", "Save"} default button "Save" with icon note
  return text returned of answer
end tell
end timeout
APPLESCRIPT
) || { echo "Cancelled. Nothing saved."; exit 1; }

KEY=$(printf '%s' "$KEY" | tr -d '[:space:]')
if [ -z "$KEY" ]; then
  echo "The key was empty. Nothing saved."
  exit 1
fi

mkdir -p "$DIR"
chmod 700 "$DIR"
umask 077
printf '%s\n' "$KEY" > "$KEY_FILE"
chmod 600 "$KEY_FILE"
rm -f "$TOKEN_FILE"
echo "Saved the Garmin key (${#KEY} characters) to: $KEY_FILE"
