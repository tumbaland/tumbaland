#!/bin/sh
set -e
cat <<EOF > /usr/share/nginx/html/config.json
{
  "ALBUM_URL": "${ALBUM_FRONT_URL}",
  "FINANCE_URL": "${FINANCE_FRONT_URL}",
  "RELATIONSHIP_URL": "${RELATIONSHIP_FRONT_URL}",
  "PUBLIC_API_URL": "${PUBLIC_API_URL}",
  "PAYMENT_URL": "${PAYMENT_FRONT_URL}",
  "GROUP_URL": "${GROUP_FRONT_URL}"
}
EOF
exec "$@"

