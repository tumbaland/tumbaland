#!/bin/sh
set -e

# Replace env variables in built files
if [ -d "/usr/share/nginx/html/assets" ]; then
  for file in /usr/share/nginx/html/assets/*.js; do
    if [ -f "$file" ]; then
      echo "Processing $file..."
      # Add any environment variable replacements here if needed
    fi
  done
fi

exec "$@"
