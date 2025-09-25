#!/bin/bash
set -e

# Tumbaland Backup Cleanup Script
# This script cleans up old backup files and enforces retention policies

echo "=========================================="
echo "Tumbaland Backup Cleanup"
echo "Started at: $(date)"
echo "=========================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="$SCRIPT_DIR/.."

# Load environment variables
if [ -f "$BACKUP_DIR/.env" ]; then
  set -a
  source "$BACKUP_DIR/.env"
  set +a
fi

# Function to log with timestamp
log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

# Set default values if not set
RESTIC_REPOSITORY=${RESTIC_REPOSITORY:-"$BACKUP_DIR/data/restic-repo"}
export RESTIC_REPOSITORY
export RESTIC_PASSWORD

# Clean up Restic snapshots
log "Cleaning up old Restic snapshots..."
if restic forget --keep-daily 7 --keep-weekly 4 --keep-monthly 12 --prune; then
  log "✓ Restic snapshots cleaned up"
else
  log "✗ Failed to clean up Restic snapshots"
fi

# Clean up local backup files (keep only recent ones)
log "Cleaning up local backup files..."

# MongoDB
if [ -d "$BACKUP_DIR/data/mongodb" ]; then
  cd "$BACKUP_DIR/data/mongodb"
  ls -t dump_* 2>/dev/null | tail -n +4 | xargs -r rm -rf
  ls -t data_* 2>/dev/null | tail -n +4 | xargs -r rm -rf
  log "✓ MongoDB local files cleaned up"
fi

# MinIO
if [ -d "$BACKUP_DIR/data/minio" ]; then
  cd "$BACKUP_DIR/data/minio"
  ls -t buckets_* 2>/dev/null | tail -n +3 | xargs -r rm -rf
  ls -t data_* 2>/dev/null | tail -n +3 | xargs -r rm -rf
  log "✓ MinIO local files cleaned up"
fi

# Redis
if [ -d "$BACKUP_DIR/data/redis" ]; then
  cd "$BACKUP_DIR/data/redis"
  ls -t dump_*.rdb 2>/dev/null | tail -n +4 | xargs -r rm -f
  ls -t config_*.txt 2>/dev/null | tail -n +4 | xargs -r rm -f
  ls -t data_* 2>/dev/null | tail -n +4 | xargs -r rm -rf
  ls -t info_*.txt 2>/dev/null | tail -n +4 | xargs -r rm -f
  log "✓ Redis local files cleaned up"
fi

# Vault (more conservative - keep only 2)
if [ -d "$BACKUP_DIR/data/vault" ]; then
  cd "$BACKUP_DIR/data/vault"
  ls -t data_* 2>/dev/null | tail -n +3 | xargs -r rm -rf
  ls -t logs_* 2>/dev/null | tail -n +3 | xargs -r rm -rf
  ls -t config_* 2>/dev/null | tail -n +3 | xargs -r rm -rf
  ls -t *.txt 2>/dev/null | grep -E "(secrets_engines|auth_methods|policies)_" | tail -n +3 | xargs -r rm -f
  ls -td policies_* 2>/dev/null | tail -n +3 | xargs -r rm -rf
  log "✓ Vault local files cleaned up"
fi

# Consul
if [ -d "$BACKUP_DIR/data/consul" ]; then
  cd "$BACKUP_DIR/data/consul"
  ls -t data_* 2>/dev/null | tail -n +4 | xargs -r rm -rf
  ls -t *.json 2>/dev/null | tail -n +10 | xargs -r rm -f  # Keep more JSON files
  log "✓ Consul local files cleaned up"
fi

# Clean up old log files (keep last 30 days)
log "Cleaning up old log files..."
find "$BACKUP_DIR/logs" -name "*.log" -mtime +30 -delete 2>/dev/null || true

# Check repository size
log "Checking repository size..."
REPO_SIZE=$(du -sh "$RESTIC_REPOSITORY" 2>/dev/null | cut -f1 || echo "Unknown")
SNAPSHOTS_COUNT=$(restic snapshots 2>/dev/null | grep -c "snapshot" || echo "0")

log "=========================================="
log "Cleanup Summary:"
log "- Repository size: $REPO_SIZE"
log "- Total snapshots: $SNAPSHOTS_COUNT"
log "- Completed at: $(date)"
log "=========================================="