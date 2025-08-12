#!/bin/sh
set -e

# Simple automated certificate obtain/renew script.
# Assumes:
#  - Container already running with port 80 serving /.well-known/acme-challenge from /usr/share/nginx/html
#  - default.conf contains a location for ACME challenges (it does now)
#  - certbot installed in the image

EMAIL="toomastahves@hotmail.com" # change if needed

# Pure in-container: use standard paths
WEBROOT="/usr/share/nginx/html"
CERT_DIR="/etc/letsencrypt"
mkdir -p "$WEBROOT/.well-known/acme-challenge"

if [ ! -d "$WEBROOT" ]; then
  echo "[error] Webroot directory $WEBROOT does not exist. Create it (mkdir -p)." >&2
  exit 2
fi

# Group domains logically so we minimize cert count (Let's Encrypt rate limits):
# Root + wildcard is NOT used here (wildcard would require DNS challenge). We keep individual certs.

DOMAIN_GROUPS=" \
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

echo "==> Starting certificate obtain/renew process"
echo "Using webroot: $WEBROOT"
echo "Using cert storage: $CERT_DIR"

echo "[info] To verify accessibility before issuing, place a test file:"
echo "  echo test > $WEBROOT/.well-known/acme-challenge/acme-test && curl -I http://tumbaland.eu/.well-known/acme-challenge/acme-test"

# If user passes domains as CLI args, restrict to those only.
if [ "$#" -gt 0 ]; then
  echo "[filter] Limiting issuance to domains passed as args: $*"
  DOMAIN_GROUPS=""
  for D in "$@"; do
    DOMAIN_GROUPS="$DOMAIN_GROUPS $D"
  done
fi

for GROUP in $DOMAIN_GROUPS; do
  # Split group into array
  set -- $GROUP
  FIRST=$1
  if [ -z "$FIRST" ]; then
    continue
  fi
  echo "-- Processing group: $GROUP"
  # Build -d args
  DOM_ARGS=""
  for D in $GROUP; do
    DOM_ARGS="$DOM_ARGS -d $D"
  done
  # Use run (obtain or renew automatically). Keep existing if valid.
  certbot certonly --webroot -w "$WEBROOT" $DOM_ARGS \
    --agree-tos --email "$EMAIL" --non-interactive --rsa-key-size 4096 --keep-until-expiring --expand || {
      echo "Cert generation failed for group: $GROUP" >&2
      exit 1
    }
done

echo "==> All certificates processed. Reloading nginx"
nginx -s reload || echo "(warn) nginx reload failed (maybe first run)."
echo "Done."
