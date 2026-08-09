#!/bin/sh

# Generate config.json at runtime using environment variables
cat > /usr/share/nginx/html/config.json << EOF
{
  "FINANCE_API_URL": "${FINANCE_API_URL}",
  "AUTH_SERVICE_URL": "${AUTH_SERVICE_URL}",
  "AUTH_FRONT_URL": "${AUTH_FRONT_URL}",
  "GROUP_API_URL": "${GROUP_API_URL}",
  "ACCOUNT_FRONT_URL": "${ACCOUNT_FRONT_URL}",
  "SHELL_FRONT_URL": "${SHELL_FRONT_URL}",
  "PUBLIC_API_URL": "${PUBLIC_API_URL}",
  "PAYMENT_API_URL": "${PAYMENT_API_URL}"
}
EOF

echo "Generated config.json with runtime environment variables:"
cat /usr/share/nginx/html/config.json

# Execute the original command
exec "$@"

