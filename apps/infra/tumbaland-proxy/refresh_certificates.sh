#!/bin/sh

# Domains to generate certs for (space-separated)
DOMAINS="tumbaland.eu api.tumbaland.eu album.tumbaland.eu album-api.tumbaland.eu relationship.tumbaland.eu relationship-api.tumbaland.eu finance.tumbaland.eu finance-api.tumbaland.eu auth.tumbaland.eu auth-api.tumbaland.eu file-api.tumbaland.eu"

EMAIL="toomastahves@hotmail.com"  # CHANGE THIS
WEBROOT="/usr/share/nginx/html"  # Nginx must be running and serving this path

for DOMAIN in $DOMAINS; do
  certbot certonly --webroot -w $WEBROOT \
    -d "$DOMAIN" --agree-tos --email "$EMAIL" --non-interactive --rsa-key-size 4096
  if [ $? -ne 0 ]; then
    echo "Failed to generate cert for $DOMAIN"
    exit 1
  fi
done

echo "SSL certificates generated and copied for Nginx."
