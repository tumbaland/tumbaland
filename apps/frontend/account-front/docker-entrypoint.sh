#!/bin/sh
set -e
cat <<EOF > /usr/share/nginx/html/config.json
{
  "AUTH_SERVICE_URL": "${AUTH_SERVICE_URL}",
  "AUTH_FRONT_URL": "${AUTH_FRONT_URL}",
  "PUBLIC_API_URL": "${PUBLIC_API_URL}",
  "SHELL_FRONT_URL": "${SHELL_FRONT_URL}"
}
EOF
exec "$@"

