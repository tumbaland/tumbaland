#!/bin/sh
set -e

# Generate temporary self-signed certificates for any domains that do not yet
# have a real Let's Encrypt cert so Nginx can start without crashing.
# Real certs will later overwrite these via refresh_certificates.sh.

DOMAINS=" \
tumbaland.eu \
api.tumbaland.eu \
album.tumbaland.eu \
album-api.tumbaland.eu \
relationship.tumbaland.eu \
relationship-api.tumbaland.eu \
finance.tumbaland.eu \
finance-api.tumbaland.eu \
auth.tumbaland.eu \
auth-api.tumbaland.eu \
file-api.tumbaland.eu \
object-detection-api.tumbaland.eu \
segmentation-api.tumbaland.eu \
payment.tumbaland.eu \
payment-api.tumbaland.eu \
group.tumbaland.eu \
group-api.tumbaland.eu \
"

for d in $DOMAINS; do
  TARGET_DIR="/etc/letsencrypt/live/$d"
  if [ ! -f "$TARGET_DIR/fullchain.pem" ]; then
    echo "[ensure_certs] Creating temporary self-signed cert for $d"
    mkdir -p "$TARGET_DIR"
    openssl req -x509 -nodes -newkey rsa:2048 -days 7 \
      -subj "/CN=$d" \
      -keyout "$TARGET_DIR/privkey.pem" \
      -out "$TARGET_DIR/fullchain.pem" >/dev/null 2>&1 || echo "(warn) openssl failed for $d"
  fi
done

echo "[ensure_certs] All placeholder cert checks complete. Launching Nginx."
exec "$@"
