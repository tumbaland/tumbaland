#!/bin/bash
# Server-side Consul service registration script
# Reads service definitions from JSON files in services/ directory

set -e

# Configuration - adjust these for your environment
CONSUL_ADDR="${CONSUL_ADDR:-http://192.168.0.131:8500}"
ACL_TOKEN="${ACL_TOKEN}"  # Your master token
SERVICES_DIR="$(dirname "$0")/services"

echo "🔍 Starting server-side service registration..."
echo "📍 Consul Address: $CONSUL_ADDR"
echo "📁 Services Directory: $SERVICES_DIR"
echo "🔑 ACL Token: ${ACL_TOKEN:+set}"

# Check if Consul is running
if ! curl -s "$CONSUL_ADDR/v1/status/leader" > /dev/null; then
    echo "❌ Error: Consul is not running or not accessible at $CONSUL_ADDR"
    exit 1
fi

echo "✅ Consul is running"

# Check if services directory exists
if [ ! -d "$SERVICES_DIR" ]; then
    echo "❌ Error: Services directory not found: $SERVICES_DIR"
    exit 1
fi

# Function to register a service from JSON file
register_service_from_file() {
    local service_file="$1"
    local service_name=$(basename "$service_file" .json)

    echo "📝 Registering service: $service_name"

    # Extract the service object from the JSON file
    local service_data
    if ! service_data=$(jq -c '.service' "$service_file" 2>/dev/null); then
        echo "❌ Failed to parse JSON file: $service_file"
        return 1
    fi

    # Capture both stdout and stderr, and get the HTTP response code
    local response
    local http_code
    response=$(curl -s -w "%{http_code}" -X PUT \
        -H "X-Consul-Token: $ACL_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$service_data" \
        "$CONSUL_ADDR/v1/agent/service/register" 2>&1)
    http_code=${response: -3}  # Last 3 characters are the HTTP code
    response_body=${response:0:${#response}-3}  # Everything except the last 3 characters

    if [ "$http_code" = "200" ]; then
        echo "✅ Successfully registered: $service_name"
    else
        echo "❌ Failed to register: $service_name (HTTP $http_code)"
        echo "Response: $response_body"
        return 1
    fi
}

# Register all services from JSON files
echo "🚀 Registering services from JSON files..."

# Find all JSON files in services directory and register them
find "$SERVICES_DIR" -name "*.json" -type f | sort | while read -r service_file; do
    register_service_from_file "$service_file"
done

echo ""
echo "🔍 Verifying registrations..."

# Check registered services
echo "📊 Registered services:"
curl -s -H "X-Consul-Token: $ACL_TOKEN" "$CONSUL_ADDR/v1/catalog/services" | jq 'keys | sort'

echo ""
echo "🎉 Service registration complete!"
echo "🌐 View services in Consul UI: $CONSUL_ADDR"
echo "📋 API endpoint: curl -H 'X-Consul-Token: $ACL_TOKEN' $CONSUL_ADDR/v1/catalog/services"