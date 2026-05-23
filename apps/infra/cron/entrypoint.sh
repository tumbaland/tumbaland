#!/bin/sh

# entrypoint for ddns updater container
# loops forever, checking public IP and invoking the update script

# allow override of check interval (seconds)
: "${CHECK_INTERVAL:=60}"

# environment variables (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID) are passed
# directly by docker-compose.  warn/fail early if missing.
if [ -z "$CLOUDFLARE_API_TOKEN" ] || [ -z "$CLOUDFLARE_ZONE_ID" ]; then
    echo "ERROR: CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID must be set" >&2
    exit 1
fi

LAST_IP=""

while true; do
    CURRENT_IP=$(curl -s https://api.ipify.org)
    if [ -z "$CURRENT_IP" ]; then
        echo "failed to fetch current IP, retrying in $CHECK_INTERVAL seconds"
    elif [ "$CURRENT_IP" != "$LAST_IP" ]; then
        echo "IP changed: ${LAST_IP:-<none>} -> $CURRENT_IP"
        # export for script if it references it directly
        export CURRENT_IP
        sh /app/update_dns.sh
        LAST_IP="$CURRENT_IP"
    else
        echo "IP unchanged ($CURRENT_IP)"
    fi
    sleep "$CHECK_INTERVAL"
done
