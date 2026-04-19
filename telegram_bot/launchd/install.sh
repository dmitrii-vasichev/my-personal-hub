#!/bin/sh
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLIST_SRC="$SCRIPT_DIR/com.my-personal-hub.telegram-bot.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.my-personal-hub.telegram-bot.plist"
LABEL="com.my-personal-hub.telegram-bot"
UID_NUM="$(id -u)"

if [ ! -f "$PLIST_SRC" ]; then
    echo "ERROR: plist not found at $PLIST_SRC" >&2
    exit 1
fi

echo "Linting $PLIST_SRC ..."
plutil -lint "$PLIST_SRC"

echo "Installing to $PLIST_DST ..."
mkdir -p "$HOME/Library/LaunchAgents"
cp "$PLIST_SRC" "$PLIST_DST"

if launchctl print "gui/$UID_NUM/$LABEL" >/dev/null 2>&1; then
    echo "Service already registered; unloading first ..."
    launchctl bootout "gui/$UID_NUM/$LABEL" 2>/dev/null || launchctl unload "$PLIST_DST" 2>/dev/null || true
fi

echo "Loading LaunchAgent ..."
if launchctl bootstrap "gui/$UID_NUM" "$PLIST_DST" 2>/dev/null; then
    echo "  Loaded via bootstrap."
else
    echo "  bootstrap failed (legacy macOS?); falling back to load."
    launchctl load -w "$PLIST_DST"
fi

sleep 1

if launchctl print "gui/$UID_NUM/$LABEL" >/dev/null 2>&1; then
    echo ""
    echo "OK  $LABEL is registered."
    echo "    Verify state:     launchctl print gui/$UID_NUM/$LABEL | grep state"
    echo "    View logs:        tail -f ~/Library/Logs/com.my-personal-hub.telegram-bot.log"
    echo "    Restart:          launchctl kickstart -k gui/$UID_NUM/$LABEL"
else
    echo "" >&2
    echo "FAIL  $LABEL was not registered." >&2
    echo "      Check ~/Library/Logs/com.my-personal-hub.telegram-bot.launchd.log for details." >&2
    exit 1
fi
