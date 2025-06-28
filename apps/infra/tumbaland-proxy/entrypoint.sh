#!/bin/sh
set -e

# List of domains to check
DOMAINS="tumbaland.eu api.tumbaland.eu album.tumbaland.eu album-api.tumbaland.eu relationship.tumbaland.eu relationship-api.tumbaland.eu finance.tumbaland.eu finance-api.tumbaland.eu auth.tumbaland.eu auth-api.tumbaland.eu file-api.tumbaland.eu"
EMAIL="toomastahves@hotmail.com"
WEBROOT="/usr/share/nginx/html"

# Path to certs
dest_dir="/etc/letsencrypt/live"

# Generate dummy cert if real one does not exist
gen_dummy_cert() {
  domain=$1
  cert_dir="$dest_dir/$domain"
  if [ ! -e "$cert_dir/fullchain.pem" ]; then
    echo "Generating dummy certificate for $domain..."
    mkdir -p "$cert_dir"
    openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
      -keyout "$cert_dir/privkey.pem" \
      -out "$cert_dir/fullchain.pem" \
      -subj "/CN=$domain"
  else
    echo "Certificate for $domain already exists. Skipping dummy."
  fi
}

# 1. Generate dummy certs if needed
for domain in $DOMAINS; do
  gen_dummy_cert $domain
done

# 2. Start nginx in background
echo "Starting nginx..."
nginx &
NGINX_PID=$!

# 3. Run certbot for each domain if needed
for DOMAIN in $DOMAINS; do
  certbot certonly --webroot -w $WEBROOT \
    -d "$DOMAIN" --agree-tos --email "$EMAIL" --non-interactive --rsa-key-size 4096
  if [ $? -ne 0 ]; then
    echo "Failed to generate cert for $DOMAIN"
    exit 1
  fi
done

# 4. Reload nginx to use real certs
echo "Reloading nginx..."
nginx -s reload

# 5. Wait for nginx to exit
wait $NGINX_PID
