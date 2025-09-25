#!/bin/bash
set -e

# Tumbaland Backup Metrics Exporter
# Exports backup metrics for Prometheus monitoring

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="$SCRIPT_DIR/.."

# Load environment variables
if [ -f "$BACKUP_DIR/.env" ]; then
  set -a
  source "$BACKUP_DIR/.env"
  set +a
fi

# Set defaults
RESTIC_REPOSITORY=${RESTIC_REPOSITORY:-"$BACKUP_DIR/data/restic-repo"}
export RESTIC_REPOSITORY
export RESTIC_PASSWORD

# Metrics output file
METRICS_FILE="/tmp/backup_metrics.prom"
TIMESTAMP=$(date +%s)

# Function to output metric
metric() {
  local name="$1"
  local value="$2"
  local help="$3"
  local type="$4"

  if [ -n "$help" ]; then
    echo "# HELP $name $help" >> "$METRICS_FILE"
  fi
  if [ -n "$type" ]; then
    echo "# TYPE $name $type" >> "$METRICS_FILE"
  fi
  echo "$name $value $TIMESTAMP" >> "$METRICS_FILE"
}

# Initialize metrics file
cat > "$METRICS_FILE" << EOF
# Tumbaland Backup System Metrics
# Generated at $(date)
EOF

# Get repository information
echo "Collecting backup metrics..."

# Repository size
REPO_SIZE_BYTES=$(du -sb "$RESTIC_REPOSITORY" 2>/dev/null | cut -f1 || echo "0")
metric "backup_repository_size_bytes" "$REPO_SIZE_BYTES" "Total size of backup repository in bytes" "gauge"

# Snapshot count
SNAPSHOTS_TOTAL=$(restic snapshots --json 2>/dev/null | jq -r '. | length' 2>/dev/null || echo "0")
metric "backup_snapshots_total" "$SNAPSHOTS_TOTAL" "Total number of backup snapshots" "gauge"

# Snapshots by service
for service in mongodb minio redis vault consul; do
  SERVICE_SNAPSHOTS=$(restic snapshots --json --tag "$service" 2>/dev/null | jq -r '. | length' 2>/dev/null || echo "0")
  metric "backup_snapshots_total{service=\"$service\"}" "$SERVICE_SNAPSHOTS" "Number of snapshots for specific service" "gauge"
done

# Last backup timestamp
LAST_BACKUP_TIMESTAMP=$(restic snapshots --json 2>/dev/null | jq -r '.[-1].time' 2>/dev/null | date -d - +%s 2>/dev/null || echo "0")
metric "backup_last_success_timestamp" "$LAST_BACKUP_TIMESTAMP" "Timestamp of last successful backup" "gauge"

# Repository health
if restic check >/dev/null 2>&1; then
  REPO_HEALTH=1
else
  REPO_HEALTH=0
fi
metric "backup_repository_health" "$REPO_HEALTH" "Repository health status (1=healthy, 0=unhealthy)" "gauge"

# Backup file counts
for service in mongodb minio redis vault consul; do
  SERVICE_FILES=$(find "$BACKUP_DIR/data/$service" -type f 2>/dev/null | wc -l || echo "0")
  metric "backup_files_total{service=\"$service\"}" "$SERVICE_FILES" "Number of backup files for specific service" "gauge"
done

# Disk usage
BACKUP_DISK_USAGE=$(df "$BACKUP_DIR" 2>/dev/null | tail -1 | awk '{print $5}' | sed 's/%//' || echo "0")
metric "backup_disk_usage_percent" "$BACKUP_DISK_USAGE" "Backup disk usage percentage" "gauge"

# Backup age (hours since last backup)
if [ "$LAST_BACKUP_TIMESTAMP" -gt 0 ]; then
  BACKUP_AGE_HOURS=$(( (TIMESTAMP - LAST_BACKUP_TIMESTAMP) / 3600 ))
else
  BACKUP_AGE_HOURS=999999
fi
metric "backup_age_hours" "$BACKUP_AGE_HOURS" "Hours since last successful backup" "gauge"

# Recent backup status (last 24 hours)
RECENT_BACKUP_SUCCESS=0
if [ "$BACKUP_AGE_HOURS" -lt 24 ]; then
  RECENT_BACKUP_SUCCESS=1
fi
metric "backup_recent_success" "$RECENT_BACKUP_SUCCESS" "Whether backup succeeded in last 24 hours (1=yes, 0=no)" "gauge"

# Output metrics
cat "$METRICS_FILE"

# Clean up
rm -f "$METRICS_FILE"