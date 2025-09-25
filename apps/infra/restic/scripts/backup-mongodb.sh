#!/bin/bash
set -e

echo "Starting MongoDB backup..."

# Configuration
MONGODB_HOST=${MONGODB_HOST:-mongodb}
MONGODB_PORT=${MONGODB_PORT:-27017}
MONGO_ROOT_USERNAME=${MONGO_ROOT_USERNAME:-admin}
MONGO_ROOT_PASSWORD=${MONGO_ROOT_PASSWORD:-password123}
BACKUP_DIR="/backup/mongodb"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Perform MongoDB dump
echo "Creating MongoDB dump..."
mongodump \
  --host "$MONGODB_HOST" \
  --port "$MONGODB_PORT" \
  --username "$MONGO_ROOT_USERNAME" \
  --password "$MONGO_ROOT_PASSWORD" \
  --out "$BACKUP_DIR/dump_$TIMESTAMP" \
  --gzip \
  --verbose

# Backup MongoDB configuration and data files
echo "Backing up MongoDB data files..."
cp -r /backup/mongodb/data "$BACKUP_DIR/data_$TIMESTAMP"

# Add to restic repository
echo "Adding MongoDB backup to restic..."
restic backup "$BACKUP_DIR/dump_$TIMESTAMP" "$BACKUP_DIR/data_$TIMESTAMP" \
  --tag mongodb \
  --tag "$TIMESTAMP"

# Clean up local backup files (keep only last 3)
echo "Cleaning up old local backups..."
cd "$BACKUP_DIR"
ls -t dump_* | tail -n +4 | xargs -r rm -rf
ls -t data_* | tail -n +4 | xargs -r rm -rf

echo "MongoDB backup completed successfully"