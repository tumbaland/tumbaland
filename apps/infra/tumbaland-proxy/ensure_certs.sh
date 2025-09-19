#!/bin/sh
set -e

# Generate temporary self-signed wildcard certificate for *.tumbaland.eu
# so Nginx can start without crashing.
# Real wildcard cert will later overwrite this via refresh_certificates.sh.

TARGET_DIR="/etc/letsencrypt/live/tumbaland-wildcard"

if [ ! -f "$TARGET_DIR/fullchain.pem" ]; then
    echo "[ensure_certs] Creating temporary self-signed wildcard cert for *.tumbaland.eu"
    mkdir -p "$TARGET_DIR"
    openssl req -x509 -nodes -newkey rsa:2048 -days 7 \
      -subj "/CN=*.tumbaland.eu" \
      -keyout "$TARGET_DIR/privkey.pem" \
      -out "$TARGET_DIR/fullchain.pem" >/dev/null 2>&1 || echo "(warn) openssl failed for wildcard cert"
fi

echo "[ensure_certs] Wildcard placeholder cert check complete. Launching Nginx."
exec "$@"
