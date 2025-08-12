#!/bin/sh

cat > /usr/share/nginx/html/config.json << EOF
{
  "GROUP_API_URL": "${GROUP_API_URL}",
  "AUTH_SERVICE_URL": "${AUTH_SERVICE_URL}",
  "AUTH_FRONT_URL": "${AUTH_FRONT_URL}"
}
EOF

echo "Generated config.json with runtime environment variables:"
cat /usr/share/nginx/html/config.json

exec "$@"
