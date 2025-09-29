#!/bin/bash

# Substitute environment variables in the config file
sed "s/\${ELASTIC_PASSWORD}/$ELASTIC_PASSWORD/g" /usr/share/filebeat/filebeat.yml > /tmp/filebeat.yml

# Change ownership to root
chown root:root /tmp/filebeat.yml

# Change permissions
chmod go-w /tmp/filebeat.yml

# Run Filebeat
exec filebeat -c /tmp/filebeat.yml
