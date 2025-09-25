#!/bin/bash
set -e

# Tumbaland Infrastructure Restore Script
# This script restores infrastructure components from backups

echo "=========================================="
echo "Tumbaland Infrastructure Restore"
echo "Started at: $(date)"
echo "=========================================="

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="/media/tom/ml/projects/tumbaland/apps/infra/backup"

# Function to log with timestamp
log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

# Function to confirm action
confirm() {
  local message="$1"
  read -p "$message (y/N): " -n 1 -r
  echo
  [[ $REPLY =~ ^[Yy]$ ]]
}

# List available snapshots
list_snapshots() {
  echo "Available snapshots:"
  restic snapshots --json | jq -r '.[] | "\(.time) - \(.id) - Tags: \(.tags | join(", "))"' 2>/dev/null || echo "No snapshots found"
}

# Restore service
restore_service() {
  local service_name="$1"
  local snapshot_id="$2"
  local restore_path="$3"

  log "Restoring $service_name from snapshot $snapshot_id to $restore_path..."

  if restic restore "$snapshot_id" --target "$restore_path" --tag "$service_name"; then
    log "✓ $service_name restore completed successfully"
    return 0
  else
    log "✗ $service_name restore failed"
    return 1
  fi
}

# Main restore process
if [ $# -lt 1 ]; then
  echo "Usage: $0 <service> [snapshot_id]"
  echo "Services: mongodb, minio, redis, vault, consul, all"
  echo ""
  list_snapshots
  exit 1
fi

SERVICE="$1"
SNAPSHOT_ID="$2"

# If no snapshot specified, use latest
if [ -z "$SNAPSHOT_ID" ]; then
  SNAPSHOT_ID=$(restic snapshots --json --latest 1 | jq -r '.[0].id' 2>/dev/null)
  if [ -z "$SNAPSHOT_ID" ]; then
    log "✗ No snapshots found"
    exit 1
  fi
  log "Using latest snapshot: $SNAPSHOT_ID"
fi

# Confirm restore action
if ! confirm "This will restore $SERVICE from backup. Continue?"; then
  log "Restore cancelled by user"
  exit 0
fi

case "$SERVICE" in
  "mongodb")
    RESTORE_PATH="/tmp/mongodb_restore"
    mkdir -p "$RESTORE_PATH"
    if restore_service "mongodb" "$SNAPSHOT_ID" "$RESTORE_PATH"; then
      log "MongoDB data restored to $RESTORE_PATH"
      log "To complete restore:"
      log "1. Stop MongoDB container: docker stop tumbaland-mongodb"
      log "2. Copy data: cp -r $RESTORE_PATH/backup/mongodb/data /path/to/mongodb/data"
      log "3. Start MongoDB container: docker start tumbaland-mongodb"
    fi
    ;;

  "minio")
    RESTORE_PATH="/tmp/minio_restore"
    mkdir -p "$RESTORE_PATH"
    if restore_service "minio" "$SNAPSHOT_ID" "$RESTORE_PATH"; then
      log "MinIO data restored to $RESTORE_PATH"
      log "To complete restore:"
      log "1. Stop MinIO container: docker stop tumbaland-minio"
      log "2. Copy data: cp -r $RESTORE_PATH/backup/minio/data /path/to/minio/data"
      log "3. Start MinIO container: docker start tumbaland-minio"
    fi
    ;;

  "redis")
    RESTORE_PATH="/tmp/redis_restore"
    mkdir -p "$RESTORE_PATH"
    if restore_service "redis" "$SNAPSHOT_ID" "$RESTORE_PATH"; then
      log "Redis data restored to $RESTORE_PATH"
      log "To complete restore:"
      log "1. Stop Redis container: docker stop tumbaland-redis"
      log "2. Copy data: cp -r $RESTORE_PATH/backup/redis/data /path/to/redis/data"
      log "3. Start Redis container: docker start tumbaland-redis"
    fi
    ;;

  "vault")
    RESTORE_PATH="/tmp/vault_restore"
    mkdir -p "$RESTORE_PATH"
    if restore_service "vault" "$SNAPSHOT_ID" "$RESTORE_PATH"; then
      log "Vault data restored to $RESTORE_PATH"
      log "⚠️  WARNING: Vault restore requires special handling!"
      log "To complete restore:"
      log "1. Stop Vault container: docker stop vault"
      log "2. Copy data: cp -r $RESTORE_PATH/backup/vault/* /path/to/vault/"
      log "3. Start Vault container: docker start vault"
      log "4. Verify Vault is accessible and unsealed"
    fi
    ;;

  "consul")
    RESTORE_PATH="/tmp/consul_restore"
    mkdir -p "$RESTORE_PATH"
    if restore_service "consul" "$SNAPSHOT_ID" "$RESTORE_PATH"; then
      log "Consul data restored to $RESTORE_PATH"
      log "To complete restore:"
      log "1. Stop Consul container: docker stop consul"
      log "2. Copy data: cp -r $RESTORE_PATH/backup/consul/data /path/to/consul/data"
      log "3. Start Consul container: docker start consul"
    fi
    ;;

  "all")
    log "Restoring all services..."
    $0 mongodb "$SNAPSHOT_ID"
    $0 minio "$SNAPSHOT_ID"
    $0 redis "$SNAPSHOT_ID"
    $0 vault "$SNAPSHOT_ID"
    $0 consul "$SNAPSHOT_ID"
    ;;

  *)
    echo "Unknown service: $SERVICE"
    echo "Available services: mongodb, minio, redis, vault, consul, all"
    exit 1
    ;;
esac

log "=========================================="
log "Restore process completed"
log "Finished at: $(date)"
log "=========================================="