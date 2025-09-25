#!/bin/bash
set -e

echo "Starting Consul backup..."

# Configuration
CONSUL_HTTP_ADDR=${CONSUL_HTTP_ADDR:-http://consul:8500}
BACKUP_DIR="/backup/consul"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Export Consul configuration
echo "Exporting Consul configuration..."

# Get datacenters
curl -s "$CONSUL_HTTP_ADDR/v1/catalog/datacenters" > "$BACKUP_DIR/datacenters_$TIMESTAMP.json"

# Get nodes
curl -s "$CONSUL_HTTP_ADDR/v1/catalog/nodes" > "$BACKUP_DIR/nodes_$TIMESTAMP.json"

# Get services
curl -s "$CONSUL_HTTP_ADDR/v1/catalog/services" > "$BACKUP_DIR/services_$TIMESTAMP.json"

# Get key-value store (if accessible)
curl -s "$CONSUL_HTTP_ADDR/v1/kv/?recurse" > "$BACKUP_DIR/kv_$TIMESTAMP.json" 2>/dev/null || echo "KV store not accessible"

# Get ACLs (if enabled)
curl -s "$CONSUL_HTTP_ADDR/v1/acl/policies" > "$BACKUP_DIR/acl_policies_$TIMESTAMP.json" 2>/dev/null || echo "ACLs not accessible"

# Get intentions
curl -s "$CONSUL_HTTP_ADDR/v1/connect/intentions" > "$BACKUP_DIR/intentions_$TIMESTAMP.json" 2>/dev/null || echo "Intentions not accessible"

# Backup Consul data directory
echo "Backing up Consul data files..."
cp -r /backup/consul/server "$BACKUP_DIR/data_$TIMESTAMP"
cp -r /backup/consul/client "$BACKUP_DIR/client_data_$TIMESTAMP"

# Add to restic repository
echo "Adding Consul backup to restic..."
restic backup "$BACKUP_DIR/data_$TIMESTAMP" "$BACKUP_DIR/client_data_$TIMESTAMP" "$BACKUP_DIR/"*"_$TIMESTAMP.json" \
  --tag consul \
  --tag "$TIMESTAMP"

# Clean up local backup files (keep only last 3)
echo "Cleaning up old local backups..."
cd "$BACKUP_DIR"
ls -t data_* | tail -n +4 | xargs -r rm -rf
ls -t client_data_* | tail -n +4 | xargs -r rm -rf
ls -t *.json | grep "_$TIMESTAMP" | head -n -10 | xargs -r rm -f  # Keep more JSON files

echo "Consul backup completed successfully"