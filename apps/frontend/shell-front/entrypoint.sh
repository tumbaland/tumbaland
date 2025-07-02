#!/bin/sh
set -e
cat <<EOF > /usr/share/nginx/html/config.json
{
  "VITE_ALBUM_URL": "${VITE_ALBUM_URL}",
  "VITE_FINANCE_URL": "${VITE_FINANCE_URL}",
  "VITE_RELATIONSHIP_URL": "${VITE_RELATIONSHIP_URL}",
  "VITE_PUBLIC_API_URL": "${VITE_PUBLIC_API_URL}"
}
EOF
exec "$@"
