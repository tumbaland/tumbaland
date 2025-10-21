#!/bin/sh

cat > /usr/share/nginx/html/config.json << EOF
{
  "VISION_API_URL": "${VISION_API_URL}",
  "AUTH_SERVICE_URL": "${AUTH_SERVICE_URL}",
  "AUTH_FRONT_URL": "${AUTH_FRONT_URL}",
  "PUBLIC_API_URL": "${PUBLIC_API_URL}",
  "SHELL_FRONT_URL": "${SHELL_FRONT_URL}"
}
EOF

echo "Generated config.json with runtime environment variables:"
cat /usr/share/nginx/html/config.json

exec "$@"

