#!/bin/sh

# Cloudflare DNS Update Script

# Load environment variables from .env file if it exists
if [ -f ".env" ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Configuration
# prefer values from environment (e.g. loaded from .env)
: "${CLOUDFLARE_ZONE_ID:?CLOUDFLARE_ZONE_ID must be set in environment or .env}"
AUTH_HEADER="Authorization: Bearer $CLOUDFLARE_API_TOKEN"

# fail early if token missing
if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
    echo "ERROR: CLOUDFLARE_API_TOKEN is not defined" >&2
    exit 1
fi

# echo only token prefix to avoid leaking the whole thing
echo "Using zone $CLOUDFLARE_ZONE_ID and token starting with ${CLOUDFLARE_API_TOKEN#????}"

# Get current public IP
CURRENT_IP=$(curl -s https://api.ipify.org)

echo "Updating DNS records with ip: $CURRENT_IP"
echo "----------------------------------------"

echo "Updating *.visin.eu..."
curl "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/dns_records/c677be8ac280fff1e4955821cf92f445" \
    -X PATCH \
    -H "Content-Type: application/json" \
    -H "$AUTH_HEADER" \
    -d "{\"content\": \"$CURRENT_IP\"}"

echo "Updating visin.eu..."
curl "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/dns_records/57f13a8001d9121346572b4669b65fca" \
    -X PATCH \
    -H "Content-Type: application/json" \
    -H "$AUTH_HEADER" \
    -d "{\"content\": \"$CURRENT_IP\"}"

echo "Updating www.visin.eu..."
curl "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/dns_records/8cb6e884818db1e1e894a929b0279cf2" \
    -X PATCH \
    -H "Content-Type: application/json" \
    -H "$AUTH_HEADER" \
    -d "{\"content\": \"$CURRENT_IP\"}"

echo "----------------------------------------"
echo "DNS update completed!"
echo "----------------------------------------"
