#!/bin/sh
set -e

# Automated wildcard certificate obtain/renew script using Cloudflare DNS challenge.
# Generates a single wildcard certificate for *.tumbaland.eu
# Assumes:
#  - Container has certbot-dns-cloudflare plugin installed
#  - CLOUDFLARE_API_TOKEN environment variable is set
#  - Cloudflare API token has DNS edit permissions for tumbaland.eu zone

EMAIL="toomastahves@hotmail.com"
CERT_DIR="/etc/letsencrypt"
CERT_NAME="tumbaland-wildcard"
CLOUDFLARE_CREDENTIALS="/app/cloudflare.ini"

# Verify CLOUDFLARE_API_TOKEN environment variable is set
if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
  echo "[error] CLOUDFLARE_API_TOKEN environment variable is not set" >&2
  exit 2
fi

# Create Cloudflare credentials file from environment variable
echo "[info] Creating Cloudflare credentials file"
cat > "$CLOUDFLARE_CREDENTIALS" << EOF
# Cloudflare API credentials for certbot DNS challenge
dns_cloudflare_api_token = $CLOUDFLARE_API_TOKEN
EOF

echo "==> Starting wildcard certificate obtain/renew process"
echo "Using cert storage: $CERT_DIR"
echo "Using Cloudflare credentials: $CLOUDFLARE_CREDENTIALS"

# Remove any existing lineage to prevent conflicts
echo "[cleanup] Removing any existing wildcard certificate"
certbot delete --cert-name "$CERT_NAME" --non-interactive >/dev/null 2>&1 || true
if [ -e "$CERT_DIR/live/$CERT_NAME" ]; then
  rm -rf "$CERT_DIR/live/$CERT_NAME"
fi
if [ -e "$CERT_DIR/archive/$CERT_NAME" ]; then
  rm -rf "$CERT_DIR/archive/$CERT_NAME"
fi
if [ -e "$CERT_DIR/renewal/$CERT_NAME.conf" ]; then
  rm -f "$CERT_DIR/renewal/$CERT_NAME.conf"
fi

# Generate wildcard certificate using DNS-01 challenge
echo "[info] Requesting wildcard certificate for *.tumbaland.eu"
certbot certonly \
  --dns-cloudflare \
  --dns-cloudflare-credentials "$CLOUDFLARE_CREDENTIALS" \
  -d "*.tumbaland.eu" \
  --cert-name "$CERT_NAME" \
  --agree-tos --email "$EMAIL" --non-interactive \
  --rsa-key-size 4096 --keep-until-expiring --expand || {
    echo "Wildcard certificate generation failed" >&2
    exit 1
  }

echo "==> Wildcard certificate generated successfully"
echo "==> Reloading nginx"
nginx -s reload || echo "(warn) nginx reload failed (maybe first run)."
echo "Done."
