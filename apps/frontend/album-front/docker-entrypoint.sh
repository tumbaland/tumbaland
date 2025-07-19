#!/bin/sh

# Generate config.json at runtime using environment variables
cat > /usr/share/nginx/html/config.json << EOF
{
  "ALBUM_API_URL": "${ALBUM_API_URL}",
  "AUTH_SERVICE_URL": "${AUTH_SERVICE_URL}",
  "AUTH_FRONT_URL": "${AUTH_FRONT_URL}",
  "ALBUM_FRONT_URL": "${ALBUM_FRONT_URL}",
  "FILE_API_URL": "${FILE_API_URL}",
  "SEGMENTATION_API_URL": "${SEGMENTATION_API_URL}",
  "OBJECT_DETECTION_API_URL": "${OBJECT_DETECTION_API_URL}"
}
EOF

echo "Generated config.json with runtime environment variables:"
cat /usr/share/nginx/html/config.json

# Execute the original command
exec "$@"
