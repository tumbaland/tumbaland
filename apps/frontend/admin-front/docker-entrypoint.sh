#!/bin/sh
set -e
cat <<EOC > /usr/share/nginx/html/config.json
{
  "ADMIN_API_URL": "${ADMIN_API_URL}",
  "CHAT_API_URL": "${CHAT_API_URL}",
  "PAYMENT_API_URL": "${PAYMENT_API_URL}",
  "AUTH_SERVICE_URL": "${AUTH_SERVICE_URL}",
  "AUTH_FRONT_URL": "${AUTH_FRONT_URL}",
  "PUBLIC_API_URL": "${PUBLIC_API_URL}",
  "SHELL_FRONT_URL": "${SHELL_FRONT_URL}"
}
EOC
exec "$@"
