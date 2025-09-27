#!/bin/bash
# Tumbaland Consul Service Deregistration Script
# This script deregisters all Tumbaland services from Consul

set -e

# Configuration
CONSUL_HTTP_ADDR="${CONSUL_HTTP_ADDR:-http://localhost:8500}"

echo "🔍 Starting Tumbaland service deregistration from Consul..."
echo "📍 Consul Address: $CONSUL_HTTP_ADDR"

# Check if Consul is running
if ! curl -s "$CONSUL_HTTP_ADDR/v1/status/leader" > /dev/null; then
    echo "❌ Error: Consul is not running or not accessible at $CONSUL_HTTP_ADDR"
    exit 1
fi

echo "✅ Consul is running"

# Function to deregister a service
deregister_service() {
    local service_name="$1"

    echo "🗑️ Deregistering service: $service_name"

    if curl -s -X PUT "$CONSUL_HTTP_ADDR/v1/agent/service/deregister/$service_name"; then
        echo "✅ Successfully deregistered: $service_name"
    else
        echo "❌ Failed to deregister: $service_name"
        return 1
    fi
}

# List of all services to deregister
SERVICES=(
    "auth-service"
    "album-service"
    "file-service"
    "finance-service"
    "group-service"
    "payment-service"
    "public-service"
    "relationship-service"
    "account-front"
    "album-front"
    "auth-front"
    "finance-front"
    "group-front"
    "payment-front"
    "relationship-front"
    "shell-front"
    "tumbaland-proxy"
)

# Deregister all services
echo "🚀 Deregistering all services..."

for service in "${SERVICES[@]}"; do
    deregister_service "$service"
done

echo ""
echo "🎉 Service deregistration complete!"
echo "📋 Remaining services: curl $CONSUL_HTTP_ADDR/v1/catalog/services"