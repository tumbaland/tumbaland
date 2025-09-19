#!/bin/sh
set -e

# echo "This will generate a new certificate for tumbaland.eu and *.tumbaland.eu"
echo "TXT records will be managed automatically via Cloudflare API"
echo ""
echo "Domains: tumbaland.eu, *.tumbaland.eu"
echo "Email: $EMAIL"
echo "Cert name: $CERT_NAME"ted wildcard certificate renewal script using Cloudflare API
# Generates a single wildcard certificate for *.tumbaland.eu
# Uses Cloudflare API to automatically manage DNS TXT records
#
# PREREQUISITES:
# - CLOUDFLARE_API_TOKEN environment variable with DNS edit permissions
# - certbot-dns-cloudflare plugin installed

EMAIL="toomastahves@hotmail.com"
CERT_DIR="/etc/letsencrypt"
CERT_NAME="tumbaland-wildcard"
CLOUDFLARE_CREDENTIALS="/app/cloudflare.ini"

echo "=================================================="
echo "TUMBALAND WILDCARD CERTIFICATE RENEWAL (AUTOMATED)"
echo "=================================================="
echo ""
echo "This will automatically generate a new wildcard certificate for *.tumbaland.eu"
echo "TXT records will be managed automatically via Cloudflare API"
echo ""
echo "Domain: *.tumbaland.eu"
echo "Email: $EMAIL"
echo "Cert name: $CERT_NAME"
echo ""

# Check if certificate already exists and show expiry
if [ -f "$CERT_DIR/live/$CERT_NAME/fullchain.pem" ]; then
    echo "Current certificate expiry:"
    openssl x509 -in "$CERT_DIR/live/$CERT_NAME/fullchain.pem" -noout -enddate | cut -d= -f2
    echo ""
fi

# Verify CLOUDFLARE_API_TOKEN environment variable is set
if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
  echo "❌ Error: CLOUDFLARE_API_TOKEN environment variable is not set"
  echo "Please set your Cloudflare API token with DNS edit permissions for tumbaland.eu"
  exit 2
fi

echo "Starting automated certificate generation process..."
echo "Using cert storage: $CERT_DIR"
echo "Using Cloudflare API for DNS challenges"
echo ""

# Create Cloudflare credentials file from environment variable
echo "[info] Creating Cloudflare credentials file"
cat > "$CLOUDFLARE_CREDENTIALS" << EOF
# Cloudflare API credentials for certbot DNS challenge
dns_cloudflare_api_token = $CLOUDFLARE_API_TOKEN
EOF

# Set restrictive permissions on credentials file
chmod 600 "$CLOUDFLARE_CREDENTIALS"

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

# Generate wildcard certificate using DNS-01 challenge with Cloudflare
echo "[info] Requesting certificate for tumbaland.eu and *.tumbaland.eu"
certbot certonly \
  --dns-cloudflare \
  --dns-cloudflare-credentials "$CLOUDFLARE_CREDENTIALS" \
  -d "tumbaland.eu" \
  -d "*.tumbaland.eu" \
  --cert-name "$CERT_NAME" \
  --agree-tos --email "$EMAIL" --non-interactive \
  --rsa-key-size 4096 --keep-until-expiring --expand \
  --dns-cloudflare-propagation-seconds 60 || {
    echo ""
    echo "❌ Certificate generation failed!"
    echo "Check the error messages above."
    echo "Make sure your CLOUDFLARE_API_TOKEN has DNS edit permissions for tumbaland.eu"
    exit 1
  }

echo ""
echo "=================================================="
echo "✅ SUCCESS: Certificate generated automatically!"
echo "=================================================="
echo ""
echo "Certificate saved to: $CERT_DIR/live/$CERT_NAME/"
echo "New certificate expiry:"
openssl x509 -in "$CERT_DIR/live/$CERT_NAME/fullchain.pem" -noout -enddate | cut -d= -f2
echo ""
echo "🔄 NEXT STEP: Restart the proxy to use new certificates"
echo "Run: docker compose restart tumbaland-proxy"
echo ""
echo "🤖 AUTOMATION: This process can be run automatically in the future"
echo "Consider setting up a cron job or CI/CD to run this script before expiry"
echo ""
echo "Done."
