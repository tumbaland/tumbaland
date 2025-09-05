#!/bin/sh

# Generate config.json at runtime using environment variables
cat > /usr/share/nginx/html/config.json << EOF
{
  "RELATIONSHIP_API_URL": "${RELATIONSHIP_API_URL}",
  "AUTH_SERVICE_URL": "${AUTH_SERVICE_URL}",
  "AUTH_FRONT_URL": "${AUTH_FRONT_URL}",
  "GROUP_API_URL": "${GROUP_API_URL}",
  "ACCOUNT_FRONT_URL": "${ACCOUNT_FRONT_URL}",
  "SHELL_FRONT_URL": "${SHELL_FRONT_URL}"
}
EOF

echo "Generated config.json with runtime environment variables:"
cat /usr/share/nginx/html/config.json

# Execute the original command
exec "$@"

