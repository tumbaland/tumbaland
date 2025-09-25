#!/bin/bash
set -e

# Tumbaland Backup Setup Script
# This script initializes the backup system

echo "=========================================="
echo "Tumbaland Backup System Setup"
echo "=========================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="$SCRIPT_DIR/.."

# Function to confirm action
confirm() {
  local message="$1"
  read -p "$message (y/N): " -n 1 -r
  echo
  [[ $REPLY =~ ^[Yy]$ ]]
}

# Check if .env file exists
if [ ! -f "$BACKUP_DIR/.env" ]; then
  echo "Creating .env file from template..."
  cp "$BACKUP_DIR/.env.example" "$BACKUP_DIR/.env"
  echo "✓ Created $BACKUP_DIR/.env"
  echo "⚠️  Please edit $BACKUP_DIR/.env with your configuration before proceeding"
  exit 1
fi

# Load environment variables
set -a
source "$BACKUP_DIR/.env"
set +a

# Create necessary directories
echo "Creating backup directories..."
mkdir -p "$BACKUP_DIR/data"
mkdir -p "$BACKUP_DIR/logs"
mkdir -p "$BACKUP_DIR/scripts"

# Initialize Restic repository
echo "Initializing Restic repository..."
if [ ! -d "$RESTIC_REPOSITORY" ]; then
  mkdir -p "$RESTIC_REPOSITORY"
fi

export RESTIC_REPOSITORY
export RESTIC_PASSWORD

if restic init 2>/dev/null; then
  echo "✓ Restic repository initialized"
else
  echo "✓ Restic repository already exists"
fi

# Test repository
echo "Testing Restic repository..."
if restic check; then
  echo "✓ Restic repository is healthy"
else
  echo "✗ Restic repository check failed"
  exit 1
fi

# Make scripts executable
echo "Setting script permissions..."
chmod +x "$BACKUP_DIR/scripts/"*.sh

# Create cron job for automated backups (optional)
if confirm "Do you want to set up automated daily backups at 2 AM?"; then
  CRON_JOB="0 2 * * * $BACKUP_DIR/scripts/backup-all.sh >> $BACKUP_DIR/logs/cron.log 2>&1"

  if (crontab -l 2>/dev/null | grep -q "$BACKUP_DIR/scripts/backup-all.sh"); then
    echo "✓ Cron job already exists"
  else
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo "✓ Added cron job for automated backups"
  fi
fi

# Test backup scripts
echo "Testing backup scripts..."
for script in backup-mongodb.sh backup-minio.sh backup-redis.sh backup-vault.sh backup-consul.sh backup-all.sh validate.sh report.sh; do
  if [ -f "$BACKUP_DIR/scripts/$script" ]; then
    echo "✓ Found $script"
  else
    echo "✗ Missing $script"
  fi
done

echo ""
echo "=========================================="
echo "Backup System Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Edit $BACKUP_DIR/.env with your actual credentials"
echo "2. Test a manual backup: $BACKUP_DIR/scripts/backup-all.sh"
echo "3. Verify backups are working: restic snapshots"
echo "4. Test restore procedure: $BACKUP_DIR/scripts/restore.sh <service>"
echo "5. Run validation: $BACKUP_DIR/scripts/validate.sh"
echo "6. Generate report: $BACKUP_DIR/scripts/report.sh"
echo "7. Import Grafana dashboard: $BACKUP_DIR/backup-dashboard.json"
echo ""
echo "For production:"
echo "- Set up offsite backup storage (S3, MinIO, etc.)"
echo "- Configure monitoring alerts for backup failures"
echo "- Test restore procedures regularly"
echo "- Set up automated validation and reporting"
echo "- Consider encrypted backup storage for sensitive data"
echo "- Monitor backup metrics in Grafana dashboard"
echo "=========================================="