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

echo "Updating *.tumbaland.eu..."
curl "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/dns_records/6d3fc5c8df508f86a31bbf40e08eef0b" \
    -X PATCH \
    -H "Content-Type: application/json" \
    -H "$AUTH_HEADER" \
    -d "{\"content\": \"$CURRENT_IP\"}"

echo "Updating tumbaland.eu..."
curl "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/dns_records/1d2b2b164059e4ef27833e779d3fa9a7" \
    -X PATCH \
    -H "Content-Type: application/json" \
    -H "$AUTH_HEADER" \
    -d "{\"content\": \"$CURRENT_IP\"}"

echo "Updating www.tumbaland.eu..."
curl "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/dns_records/28ae3c518ddba3b6b37069b213e7a6ee" \
    -X PATCH \
    -H "Content-Type: application/json" \
    -H "$AUTH_HEADER" \
    -d "{\"content\": \"$CURRENT_IP\"}"

echo "----------------------------------------"
echo "DNS update completed!"
echo "----------------------------------------"
