#!/bin/bash

# ELK Stack User Setup Script
# This script creates the required users for the ELK stack deployment

set -e

# Source environment variables
source .env

# Configuration
ELASTIC_PASSWORD=${ELASTIC_PASSWORD}  # Should match your .env file
KIBANA_SYSTEM_PASSWORD=${KIBANA_SYSTEM_PASSWORD}  # Password for kibanaland
KIBANA_ADMIN_PASSWORD=${KIBANA_ADMIN_PASSWORD}  # Password for kibana_admin
ELASTICSEARCH_URL="http://localhost:9200"

echo "Setting up ELK Stack users..."

# Wait for Elasticsearch to be ready
echo "Waiting for Elasticsearch to be ready..."
until curl -s -u elastic:$ELASTIC_PASSWORD $ELASTICSEARCH_URL/_cluster/health > /dev/null; do
    echo "Waiting for Elasticsearch..."
    sleep 5
done

echo "Elasticsearch is ready. Creating users..."

echo "Creating/updating fleet_admin role..."
curl -X PUT -u elastic:$ELASTIC_PASSWORD \
  "$ELASTICSEARCH_URL/_security/role/fleet_admin" \
  -H 'Content-Type: application/json' \
  -d "{
    \"cluster\": [\"all\"],
    \"indices\": [
      {
        \"names\": [\"logs-*-*\", \"metrics-*-*\", \"traces-*-*\", \"synthetics-*-*\", \".fleet-*\", \".kibana-*\", \"tumbaland-*\", \"filebeat-*\"],
        \"privileges\": [\"all\"]
      }
    ]
  }"

echo "Creating super_admin role..."
curl -X PUT -u elastic:$ELASTIC_PASSWORD \
  "$ELASTICSEARCH_URL/_security/role/super_admin" \
  -H 'Content-Type: application/json' \
  -d "{
    \"cluster\": [\"all\"],
    \"indices\": [
      {
        \"names\": [\"*\"],
        \"privileges\": [\"all\"]
      }
    ]
  }"

# Create Kibana system user (for internal Kibana authentication)
echo "Creating kibanaland..."
curl -X POST -u elastic:$ELASTIC_PASSWORD \
  "$ELASTICSEARCH_URL/_security/user/kibanaland" \
  -H 'Content-Type: application/json' \
  -d "{
    \"password\": \"$KIBANA_SYSTEM_PASSWORD\",
    \"roles\": [\"kibana_system\"]
  }"

# Create Kibana admin user (for web UI access)
echo "Creating kibana_admin..."
curl -X POST -u elastic:$ELASTIC_PASSWORD \
  "$ELASTICSEARCH_URL/_security/user/kibana_admin" \
  -H 'Content-Type: application/json' \
  -d "{
    \"password\": \"$KIBANA_ADMIN_PASSWORD\",
    \"roles\": [\"kibana_admin\", \"fleet_admin\", \"super_admin\"],
    \"full_name\": \"Kibana Admin\",
    \"email\": \"admin@tumbaland.local\"
  }"

echo "Users created successfully!"
echo ""
echo "Kibana Web UI Credentials:"
echo "  URL: http://localhost:5601"
echo "  Username: kibana_admin"
echo "  Password: $KIBANA_ADMIN_PASSWORD"
echo ""
echo "To start the stack: docker compose up -d"