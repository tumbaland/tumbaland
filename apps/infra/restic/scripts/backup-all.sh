#!/bin/bash
set -e

# Tumbaland Infrastructure Backup Script
# This script performs comprehensive backups of all critical infrastructure components

echo "=========================================="
echo "Tumbaland Infrastructure Backup"
echo "Started at: $(date)"
echo "=========================================="

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="/media/tom/ml/projects/tumbaland/apps/infra/backup"
LOG_FILE="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).log"

# Redirect output to log file
exec > >(tee -a "$LOG_FILE") 2>&1

# Function to log with timestamp
log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

# Function to send notification
send_notification() {
  local subject="$1"
  local message="$2"

  if [ -n "$NOTIFICATION_EMAIL" ] && [ -n "$SMTP_SERVER" ]; then
    echo "$message" | mail -s "$subject" "$NOTIFICATION_EMAIL" || log "Failed to send email notification"
  fi
}

# Pre-backup checks
log "Performing pre-backup checks..."

# Check if services are running
check_service() {
  local service="$1"
  local container_name="$2"

  if docker ps | grep -q "$container_name"; then
    log "✓ $service is running"
    return 0
  else
    log "✗ $service is not running - skipping backup"
    return 1
  fi
}

# Backup individual services
backup_service() {
  local service_name="$1"
  local script_path="$SCRIPT_DIR/$service_name.sh"

  log "Starting $service_name backup..."
  if [ -f "$script_path" ]; then
    if bash "$script_path"; then
      log "✓ $service_name backup completed successfully"
      return 0
    else
      log "✗ $service_name backup failed"
      return 1
    fi
  else
    log "✗ $service_name backup script not found: $script_path"
    return 1
  fi
}

# Main backup process
FAILED_BACKUPS=()

# Check services
check_service "MongoDB" "tumbaland-mongodb" && MONGODB_RUNNING=true || MONGODB_RUNNING=false
check_service "MinIO" "tumbaland-minio" && MINIO_RUNNING=true || MINIO_RUNNING=false
check_service "Redis" "tumbaland-redis" && REDIS_RUNNING=true || REDIS_RUNNING=false
check_service "Vault" "vault" && VAULT_RUNNING=true || VAULT_RUNNING=false
check_service "Consul" "consul" && CONSUL_RUNNING=true || CONSUL_RUNNING=false

# Perform backups
[ "$MONGODB_RUNNING" = true ] && backup_service "backup-mongodb" || FAILED_BACKUPS+=("MongoDB")
[ "$MINIO_RUNNING" = true ] && backup_service "backup-minio" || FAILED_BACKUPS+=("MinIO")
[ "$REDIS_RUNNING" = true ] && backup_service "backup-redis" || FAILED_BACKUPS+=("Redis")
[ "$VAULT_RUNNING" = true ] && backup_service "backup-vault" || FAILED_BACKUPS+=("Vault")
[ "$CONSUL_RUNNING" = true ] && backup_service "backup-consul" || FAILED_BACKUPS+=("Consul")

# Post-backup operations
log "Performing post-backup operations..."

# Verify backup integrity
log "Verifying backup integrity..."
if restic check; then
  log "✓ Backup repository integrity verified"
else
  log "✗ Backup repository integrity check failed"
  FAILED_BACKUPS+=("Repository Integrity")
fi

# Generate backup report
BACKUP_SIZE=$(du -sh "$BACKUP_DIR/data" 2>/dev/null | cut -f1 || echo "Unknown")
SNAPSHOTS_COUNT=$(restic snapshots 2>/dev/null | grep -c "snapshot" || echo "0")

log "=========================================="
log "Backup Summary:"
log "- Backup size: $BACKUP_SIZE"
log "- Total snapshots: $SNAPSHOTS_COUNT"
log "- Completed at: $(date)"
log "=========================================="

# Send notification
if [ ${#FAILED_BACKUPS[@]} -eq 0 ]; then
  send_notification "Tumbaland Backup Success" "All backups completed successfully. Size: $BACKUP_SIZE, Snapshots: $SNAPSHOTS_COUNT"
  log "✓ All backups completed successfully"
  exit 0
else
  FAILED_LIST=$(IFS=', '; echo "${FAILED_BACKUPS[*]}")
  send_notification "Tumbaland Backup Failed" "Backup completed with failures. Failed services: $FAILED_LIST"
  log "✗ Backup completed with failures: $FAILED_LIST"
  exit 1
fi