#!/bin/sh
set -eu

PLIST_DST="$HOME/Library/LaunchAgents/com.my-personal-hub.telegram-bot.plist"
LABEL="com.my-personal-hub.telegram-bot"
UID_NUM="$(id -u)"

UNLOADED=0

if launchctl print "gui/$UID_NUM/$LABEL" >/dev/null 2>&1; then
    echo "Unloading $LABEL ..."
    if launchctl bootout "gui/$UID_NUM/$LABEL" 2>/dev/null; then
        echo "  Unloaded via bootout."
        UNLOADED=1
    elif [ -f "$PLIST_DST" ]; then
        launchctl unload -w "$PLIST_DST" 2>/dev/null || true
        echo "  Unloaded via legacy unload."
        UNLOADED=1
    fi
else
    echo "Service $LABEL not currently registered."
fi

if [ -f "$PLIST_DST" ]; then
    rm "$PLIST_DST"
    echo "Removed $PLIST_DST"
fi

# launchctl bootout is asynchronous; poll briefly for the service to
# actually disappear so the final status message matches reality.
for _ in 1 2 3 4 5; do
    if ! launchctl print "gui/$UID_NUM/$LABEL" >/dev/null 2>&1; then
        break
    fi
    sleep 1
done

if launchctl print "gui/$UID_NUM/$LABEL" >/dev/null 2>&1; then
    echo ""
    echo "WARN  $LABEL still appears registered after 5s; run 'launchctl print gui/$UID_NUM/$LABEL' to inspect." >&2
    exit 1
fi

echo ""
echo "OK  Uninstalled $LABEL"
