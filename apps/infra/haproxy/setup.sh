#!/bin/bash

# HAProxy Setup Script
# This script sets up HAProxy as a high-performance API gateway

set -e

echo "🚀 Setting up HAProxy API Gateway..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker first."
    exit 1
fi

# Check if tumbanet exists
if ! docker network ls | grep -q tumbanet; then
    print_status "Creating tumbanet..."
    docker network create tumbanet
fi

# Create necessary directories
print_status "Creating configuration directories..."
mkdir -p errors lua

# Create error pages
print_status "Creating error pages..."
cat > errors/400.http << 'EOF'
HTTP/1.1 400 Bad Request
Content-Type: text/html

<html>
<head><title>400 Bad Request</title></head>
<body>
<h1>400 Bad Request</h1>
<p>Your request could not be processed.</p>
</body>
</html>
EOF

cat > errors/403.http << 'EOF'
HTTP/1.1 403 Forbidden
Content-Type: text/html

<html>
<head><title>403 Forbidden</title></head>
<body>
<h1>403 Forbidden</h1>
<p>Access to this resource is forbidden.</p>
</body>
</html>
EOF

cat > errors/408.http << 'EOF'
HTTP/1.1 408 Request Timeout
Content-Type: text/html

<html>
<head><title>408 Request Timeout</title></head>
<body>
<h1>408 Request Timeout</h1>
<p>Your request timed out.</p>
</body>
</html>
EOF

cat > errors/500.http << 'EOF'
HTTP/1.1 500 Internal Server Error
Content-Type: text/html

<html>
<head><title>500 Internal Server Error</title></head>
<body>
<h1>500 Internal Server Error</h1>
<p>An internal server error occurred.</p>
</body>
</html>
EOF

cat > errors/502.http << 'EOF'
HTTP/1.1 502 Bad Gateway
Content-Type: text/html

<html>
<head><title>502 Bad Gateway</title></head>
<body>
<h1>502 Bad Gateway</h1>
<p>The server received an invalid response from an upstream server.</p>
</body>
</html>
EOF

cat > errors/503.http << 'EOF'
HTTP/1.1 503 Service Unavailable
Content-Type: text/html

<html>
<head><title>503 Service Unavailable</title></head>
<body>
<h1>503 Service Unavailable</h1>
<p>The service is temporarily unavailable.</p>
</body>
</html>
EOF

cat > errors/504.http << 'EOF'
HTTP/1.1 504 Gateway Timeout
Content-Type: text/html

<html>
<head><title>504 Gateway Timeout</title></head>
<body>
<h1>504 Gateway Timeout</h1>
<p>The gateway timed out waiting for the upstream server.</p>
</body>
</html>
EOF

# Create Lua script for advanced health checks
print_status "Creating Lua health check script..."
cat > lua/check.lua << 'EOF'
-- Advanced health check functions for HAProxy

-- Function to perform HTTP health checks with custom logic
function http_check(applet)
    local response = applet:http_get("/health")
    if response then
        local status = response:status()
        if status == 200 then
            return "up"
        else
            return "down"
        end
    else
        return "down"
    end
end

-- Function to add custom headers
function add_custom_headers(applet)
    applet:set_header("X-Gateway", "HAProxy")
    applet:set_header("X-Request-Time", os.date("%Y-%m-%d %H:%M:%S"))
end

core.register_action("http_check", {"http"}, http_check)
core.register_action("add_custom_headers", {"http"}, add_custom_headers)
EOF

# Copy environment file
if [ ! -f .env ]; then
    print_status "Copying environment configuration..."
    cp .env.example .env
fi

# Validate HAProxy configuration
print_status "Validating HAProxy configuration..."
if docker run --rm -v $(pwd)/haproxy.cfg:/usr/local/etc/haproxy/haproxy.cfg:ro haproxy:2.8 haproxy -c -f /usr/local/etc/haproxy/haproxy.cfg; then
    print_success "HAProxy configuration is valid"
else
    print_error "HAProxy configuration is invalid"
    exit 1
fi

# Start HAProxy
print_status "Starting HAProxy..."
docker-compose up -d

# Wait for HAProxy to be healthy
print_status "Waiting for HAProxy to be healthy..."
sleep 10

# Check HAProxy health
if curl -f http://localhost:8404/stats > /dev/null 2>&1; then
    print_success "HAProxy is running and accessible"
else
    print_error "HAProxy failed to start or is not accessible"
    exit 1
fi

# Test basic functionality
print_status "Testing basic HAProxy functionality..."
if curl -f -I http://localhost > /dev/null 2>&1; then
    print_success "HAProxy proxy functionality working"
else
    print_warning "HAProxy proxy test failed (expected if no services are running)"
fi

print_success "HAProxy setup completed!"
echo ""
echo "📋 Access URLs:"
echo "  HAProxy Stats:      http://localhost:8404/stats"
echo "  HAProxy Proxy:      http://localhost"
echo "  HAProxy HTTPS:      https://localhost (when SSL configured)"
echo ""
echo "🔧 Next steps:"
echo "  1. Start your backend services"
echo "  2. Test routing: curl http://localhost/api/albums"
echo "  3. Monitor stats: http://localhost:8404/stats"
echo "  4. Configure SSL certificates for production"
echo ""
echo "📚 Documentation: See README.md for detailed configuration instructions"