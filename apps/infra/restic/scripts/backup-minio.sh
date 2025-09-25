#!/bin/bash
set -e

echo "Starting MinIO backup..."

# Configuration
MINIO_ENDPOINT=${MINIO_ENDPOINT:-http://minio:9000}
MINIO_ROOT_USER=${MINIO_ROOT_USER:-tumbaland_admin}
MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD:-secure_password_123}
BACKUP_DIR="/backup/minio"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Configure mc client
echo "Configuring MinIO client..."
mc alias set source "$MINIO_ENDPOINT" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"

# List all buckets
echo "Listing MinIO buckets..."
BUCKETS=$(mc ls source/ | awk '{print $5}')

# Backup bucket metadata and structure
echo "Backing up bucket metadata..."
mc admin info source > "$BACKUP_DIR/admin_info_$TIMESTAMP.txt"

# For large-scale storage, we'll use MinIO's replication features
# For now, create a mirror of critical buckets (you may want to adjust this)
echo "Creating mirror of critical buckets..."
for bucket in $BUCKETS; do
  echo "Mirroring bucket: $bucket"
  # Create a snapshot directory for this bucket
  mkdir -p "$BACKUP_DIR/buckets_$TIMESTAMP/$bucket"

  # Get bucket info
  mc stat "source/$bucket" > "$BACKUP_DIR/buckets_$TIMESTAMP/$bucket/info.txt" 2>/dev/null || true

  # For large buckets, you might want to use MinIO replication instead
  # For smaller buckets or critical data, mirror them
  if [[ "$bucket" == "photos" || "$bucket" == "thumbnails" ]]; then
    echo "Creating full mirror for critical bucket: $bucket"
    mc mirror "source/$bucket" "$BACKUP_DIR/buckets_$TIMESTAMP/$bucket/" --overwrite || true
  else
    # For other buckets, just backup the structure
    mc ls "source/$bucket" > "$BACKUP_DIR/buckets_$TIMESTAMP/$bucket/objects.txt" 2>/dev/null || true
  fi
done

# Backup MinIO data files (for disaster recovery)
echo "Backing up MinIO data files..."
cp -r /backup/minio/data "$BACKUP_DIR/data_$TIMESTAMP"

# Add to restic repository
echo "Adding MinIO backup to restic..."
restic backup "$BACKUP_DIR/buckets_$TIMESTAMP" "$BACKUP_DIR/data_$TIMESTAMP" \
  --tag minio \
  --tag "$TIMESTAMP"

# Clean up local backup files (keep only last 2)
echo "Cleaning up old local backups..."
cd "$BACKUP_DIR"
ls -t buckets_* | tail -n +3 | xargs -r rm -rf
ls -t data_* | tail -n +3 | xargs -r rm -rf

echo "MinIO backup completed successfully"
echo "Note: For petabyte-scale storage, consider using MinIO Server-Side Replication for continuous backup"