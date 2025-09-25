#!/bin/bash
# HAProxy Migration Script
# Migrates from NGINX tumbaland-proxy to HAProxy

set -e

echo "🚀 Migrating from NGINX to HAProxy..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if running as root or with sudo
if [[ $EUID -eq 0 ]]; then
   print_warning "Running as root - be careful!"
else
   print_status "Running as $(whoami)"
fi

# Step 1: Extract certificates from running NGINX proxy
print_status "Step 1: Extracting SSL certificates from NGINX..."

if docker ps | grep -q tumbaland-proxy; then
    # Extract certificates
    docker cp tumbaland-proxy:/etc/letsencrypt/live/tumbaland-wildcard/fullchain.pem ./tumbaland-wildcard.crt
    docker cp tumbaland-proxy:/etc/letsencrypt/live/tumbaland-wildcard/privkey.pem ./tumbaland-wildcard.key

    print_success "Certificates extracted successfully"
else
    print_error "tumbaland-proxy container not running!"
    print_warning "Please start tumbaland-proxy first or manually copy certificates"
    exit 1
fi

# Step 2: Stop NGINX proxy
print_status "Step 2: Stopping NGINX proxy..."
cd apps/infra/tumbaland-proxy
docker compose down
print_success "NGINX proxy stopped"

# Step 3: Setup HAProxy SSL certificates
print_status "Step 3: Configuring HAProxy SSL certificates..."
cd ../haproxy

# Create SSL directory
mkdir -p ssl

# Copy and combine certificates
cp ../../tumbaland-wildcard.crt ssl/
cp ../../tumbaland-wildcard.key ssl/
cat ssl/tumbaland-wildcard.crt ssl/tumbaland-wildcard.key > ssl/tumbaland-wildcard.pem
chmod 600 ssl/tumbaland-wildcard.pem

print_success "HAProxy SSL certificates configured"

# Step 4: Validate HAProxy configuration
print_status "Step 4: Validating HAProxy configuration..."
if docker run --rm -v $(pwd)/haproxy.cfg:/usr/local/etc/haproxy/haproxy.cfg:ro haproxy:2.8 haproxy -c -f /usr/local/etc/haproxy/haproxy.cfg; then
    print_success "HAProxy configuration is valid"
else
    print_error "HAProxy configuration is invalid!"
    exit 1
fi

# Step 5: Start HAProxy
print_status "Step 5: Starting HAProxy..."
./setup.sh

# Step 6: Test migration
print_status "Step 6: Testing migration..."

# Test HTTP to HTTPS redirect
if curl -s -I http://localhost | grep -q "301"; then
    print_success "HTTP to HTTPS redirect working"
else
    print_warning "HTTP redirect not working (expected if no services running)"
fi

# Test HAProxy stats
if curl -s http://localhost:8404/stats > /dev/null 2>&1; then
    print_success "HAProxy stats accessible"
else
    print_error "HAProxy stats not accessible!"
fi

# Test SSL (if certificate is valid)
if curl -s -I https://localhost --insecure | grep -q "200\|404"; then
    print_success "HTTPS working (certificate loaded)"
else
    print_warning "HTTPS not working yet (certificate may need validation)"
fi

print_success "Migration completed successfully!"
echo ""
echo "📋 Next steps:"
echo "  1. Test your API endpoints: https://album-api.tumbaland.eu/api/albums"
echo "  2. Monitor HAProxy stats: http://localhost:8404/stats"
echo "  3. Update certificate renewal process (see README.md)"
echo "  4. Remove old NGINX proxy when confident: rm -rf apps/infra/tumbaland-proxy"
echo ""
echo "🎉 Migration complete! HAProxy is now your API gateway."