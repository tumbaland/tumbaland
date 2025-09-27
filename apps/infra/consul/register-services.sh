#!/bin/bash
# Tumbaland Consul Service Registration Script
# This script registers all Tumbaland services with Consul

set -e

# Configuration
CONSUL_HTTP_ADDR="${CONSUL_HTTP_ADDR:-http://localhost:8500}"
SERVICES_DIR="$(dirname "$0")/services"
CONSUL_ACL_TOKEN="${CONSUL_ACL_TOKEN:-}"

echo "🔍 Starting Tumbaland service registration with Consul..."
echo "📍 Consul Address: $CONSUL_HTTP_ADDR"
echo "📁 Services Directory: $SERVICES_DIR"
echo "🔑 ACL Token: ${CONSUL_ACL_TOKEN:+set}"

# Check if Consul is running
if ! curl -s "$CONSUL_HTTP_ADDR/v1/status/leader" > /dev/null; then
    echo "❌ Error: Consul is not running or not accessible at $CONSUL_HTTP_ADDR"
    exit 1
fi

echo "✅ Consul is running"

# Function to register a service
register_service() {
    local service_file="$1"
    local service_name

    service_name=$(basename "$service_file" .json)

    echo "📝 Registering service: $service_name"

    local curl_cmd="curl -s -X PUT"
    if [ -n "$CONSUL_ACL_TOKEN" ]; then
        curl_cmd="$curl_cmd -H \"X-Consul-Token: $CONSUL_ACL_TOKEN\""
    fi
    curl_cmd="$curl_cmd -d @\"$service_file\" \"$CONSUL_HTTP_ADDR/v1/agent/service/register\""

    if eval "$curl_cmd"; then
        echo "✅ Successfully registered: $service_name"
    else
        echo "❌ Failed to register: $service_name"
        return 1
    fi
}

# Function to check if service is registered
check_service() {
    local service_name="$1"

    local curl_cmd="curl -s"
    if [ -n "$CONSUL_ACL_TOKEN" ]; then
        curl_cmd="$curl_cmd -H \"X-Consul-Token: $CONSUL_ACL_TOKEN\""
    fi
    curl_cmd="$curl_cmd \"$CONSUL_HTTP_ADDR/v1/catalog/service/$service_name\""

    if eval "$curl_cmd" | grep -q '"ServiceName"'; then
        echo "✅ Service $service_name is registered"
        return 0
    else
        echo "❌ Service $service_name is not registered"
        return 1
    fi
}

# Register all services
echo "🚀 Registering all services..."

# Backend services
register_service "$SERVICES_DIR/auth-service.json"
register_service "$SERVICES_DIR/album-service.json"
register_service "$SERVICES_DIR/file-service.json"
register_service "$SERVICES_DIR/finance-service.json"
register_service "$SERVICES_DIR/group-service.json"
register_service "$SERVICES_DIR/payment-service.json"
register_service "$SERVICES_DIR/public-service.json"
register_service "$SERVICES_DIR/relationship-service.json"

# Frontend services
register_service "$SERVICES_DIR/account-front.json"
register_service "$SERVICES_DIR/album-front.json"
register_service "$SERVICES_DIR/auth-front.json"
register_service "$SERVICES_DIR/finance-front.json"
register_service "$SERVICES_DIR/group-front.json"
register_service "$SERVICES_DIR/payment-front.json"
register_service "$SERVICES_DIR/relationship-front.json"
register_service "$SERVICES_DIR/shell-front.json"

# Infrastructure services
register_service "$SERVICES_DIR/tumbaland-proxy.json"

echo ""
echo "🔍 Verifying service registrations..."

# Check all services
check_service "auth-service"
check_service "album-service"
check_service "file-service"
check_service "finance-service"
check_service "group-service"
check_service "payment-service"
check_service "public-service"
check_service "relationship-service"
check_service "account-front"
check_service "album-front"
check_service "auth-front"
check_service "finance-front"
check_service "group-front"
check_service "payment-front"
check_service "relationship-front"
check_service "shell-front"
check_service "tumbaland-proxy"

echo ""
echo "📊 Service Registration Summary:"
echo "   Backend Services: 8"
echo "   Frontend Services: 8"
echo "   Infrastructure: 1"
echo "   Total Services: 17"

echo ""
echo "🎉 Service registration complete!"
echo "🌐 View services in Consul UI: $CONSUL_HTTP_ADDR"
echo "📋 List all services: curl $CONSUL_HTTP_ADDR/v1/catalog/services"