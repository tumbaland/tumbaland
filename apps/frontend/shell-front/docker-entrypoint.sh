#!/bin/sh
set -e
cat <<EOF > /usr/share/nginx/html/config.json
{
  "ALBUM_URL": "${ALBUM_URL}",
  "FINANCE_URL": "${FINANCE_URL}",
  "RELATIONSHIP_URL": "${RELATIONSHIP_URL}",
  "PUBLIC_API_URL": "${PUBLIC_API_URL}"
}
EOF
exec "$@"
