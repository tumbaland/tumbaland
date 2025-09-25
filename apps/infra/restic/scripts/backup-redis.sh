#!/bin/bash
set -e

echo "Starting Redis backup..."

# Configuration
REDIS_HOST=${REDIS_HOST:-redis}
REDIS_PORT=${REDIS_PORT:-6379}
REDIS_PASSWORD=${REDIS_PASSWORD:-redis_password_123}
BACKUP_DIR="/backup/redis"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Perform Redis dump (RDB snapshot)
echo "Creating Redis RDB snapshot..."
redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" --rdb "$BACKUP_DIR/dump_$TIMESTAMP.rdb"

# Backup Redis configuration
echo "Backing up Redis configuration..."
redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" config get "*" > "$BACKUP_DIR/config_$TIMESTAMP.txt"

# Backup Redis data directory
echo "Backing up Redis data files..."
cp -r /backup/redis/data "$BACKUP_DIR/data_$TIMESTAMP"

# Get Redis info for monitoring
echo "Getting Redis info..."
redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" info > "$BACKUP_DIR/info_$TIMESTAMP.txt"

# Add to restic repository
echo "Adding Redis backup to restic..."
restic backup "$BACKUP_DIR/dump_$TIMESTAMP.rdb" "$BACKUP_DIR/config_$TIMESTAMP.txt" "$BACKUP_DIR/data_$TIMESTAMP" "$BACKUP_DIR/info_$TIMESTAMP.txt" \
  --tag redis \
  --tag "$TIMESTAMP"

# Clean up local backup files (keep only last 3)
echo "Cleaning up old local backups..."
cd "$BACKUP_DIR"
ls -t dump_*.rdb | tail -n +4 | xargs -r rm -f
ls -t config_*.txt | tail -n +4 | xargs -r rm -f
ls -t data_* | tail -n +4 | xargs -r rm -rf
ls -t info_*.txt | tail -n +4 | xargs -r rm -f

echo "Redis backup completed successfully"