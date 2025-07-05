#!/bin/sh

# Generate config.js at runtime using environment variables
cat > /usr/share/nginx/html/config.js << EOF
// Runtime configuration for album-front
// Generated at container startup

window.APP_CONFIG = {
  ALBUM_API_URL: '${ALBUM_API_URL}',
  AUTH_SERVICE_URL: '${AUTH_SERVICE_URL}',
  AUTH_FRONT_URL: '${AUTH_FRONT_URL}'
};
EOF

echo "Generated config.js with runtime environment variables:"
cat /usr/share/nginx/html/config.js

# Execute the original command
exec "$@"
