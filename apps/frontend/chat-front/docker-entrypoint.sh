#!/bin/sh

cat > /usr/share/nginx/html/config.json << EOF2
{
  "CHAT_API_URL": "${CHAT_API_URL}",
  "AUTH_SERVICE_URL": "${AUTH_SERVICE_URL}",
  "AUTH_FRONT_URL": "${AUTH_FRONT_URL}",
  "CHAT_FRONT_URL": "${CHAT_FRONT_URL}",
  "SHELL_FRONT_URL": "${SHELL_FRONT_URL}",
  "PUBLIC_API_URL": "${PUBLIC_API_URL}"
}
EOF2

echo "Generated config.json with runtime environment variables:"
cat /usr/share/nginx/html/config.json

exec "$@"
