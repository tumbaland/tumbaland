#!/bin/bash

# ELK Stack User Setup Script
# This script creates the required users for the ELK stack deployment

set -e

# Configuration
ELASTIC_PASSWORD=${ELASTIC_PASSWORD}  # Should match your .env file
KIBANA_SYSTEM_PASSWORD=${KIBANA_SYSTEM_PASSWORD}  # Password for kibanaland
ELASTICSEARCH_URL="http://localhost:9200"

echo "Setting up ELK Stack users..."

# Wait for Elasticsearch to be ready
echo "Waiting for Elasticsearch to be ready..."
until curl -s -u elastic:$ELASTIC_PASSWORD $ELASTICSEARCH_URL/_cluster/health > /dev/null; do
    echo "Waiting for Elasticsearch..."
    sleep 5
done

echo "Elasticsearch is ready. Creating users..."

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
  -d '{
    "password": "admin_password_123",
    "roles": ["kibana_admin", "monitoring_user"]
  }'

echo "Users created successfully!"
echo ""
echo "Kibana Web UI Credentials:"
echo "  URL: http://localhost:5601"
echo "  Username: kibana_admin"
echo "  Password: admin_password_123"
echo ""
echo "To start the stack: docker compose up -d"