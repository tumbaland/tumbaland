#!/bin/bash
set -e

# Tumbaland Backup Validation Script
# Periodically tests backup integrity by attempting restores

echo "=========================================="
echo "Tumbaland Backup Validation"
echo "Started at: $(date)"
echo "=========================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="$SCRIPT_DIR/.."
VALIDATION_DIR="/tmp/backup_validation_$(date +%s)"

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

# Function to log with timestamp
log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

# Function to cleanup
cleanup() {
  log "Cleaning up validation directory..."
  rm -rf "$VALIDATION_DIR"
}

# Set trap for cleanup
trap cleanup EXIT

# Create validation directory
mkdir -p "$VALIDATION_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Validation results
VALIDATIONS_RUN=0
VALIDATIONS_PASSED=0
VALIDATIONS_FAILED=0

# Validate repository
log "Validating repository integrity..."
if restic check --read-data >/dev/null 2>&1; then
  log "✓ Repository integrity check passed"
  VALIDATIONS_PASSED=$((VALIDATIONS_PASSED + 1))
else
  log "✗ Repository integrity check failed"
  VALIDATIONS_FAILED=$((VALIDATIONS_FAILED + 1))
fi
VALIDATIONS_RUN=$((VALIDATIONS_RUN + 1))

# Test snapshot listing
log "Testing snapshot listing..."
if restic snapshots >/dev/null 2>&1; then
  log "✓ Snapshot listing works"
  VALIDATIONS_PASSED=$((VALIDATIONS_PASSED + 1))
else
  log "✗ Snapshot listing failed"
  VALIDATIONS_FAILED=$((VALIDATIONS_FAILED + 1))
fi
VALIDATIONS_RUN=$((VALIDATIONS_RUN + 1))

# Test restore of latest snapshot (shallow test)
log "Testing shallow restore of latest snapshot..."
LATEST_SNAPSHOT=$(restic snapshots --json 2>/dev/null | jq -r '.[-1].id' 2>/dev/null || echo "")

if [ -n "$LATEST_SNAPSHOT" ]; then
  TEST_RESTORE_DIR="$VALIDATION_DIR/shallow_restore"
  mkdir -p "$TEST_RESTORE_DIR"

  # Try to restore just a small portion to test functionality
  if timeout 300 restic restore "$LATEST_SNAPSHOT" --target "$TEST_RESTORE_DIR" --include "*.json" --include "*.txt" >/dev/null 2>&1; then
    log "✓ Shallow restore test passed"
    VALIDATIONS_PASSED=$((VALIDATIONS_PASSED + 1))
  else
    log "✗ Shallow restore test failed"
    VALIDATIONS_FAILED=$((VALIDATIONS_FAILED + 1))
  fi
else
  log "⚠ No snapshots found for restore test"
fi
VALIDATIONS_RUN=$((VALIDATIONS_RUN + 1))

# Test backup script syntax
log "Testing backup script syntax..."
for script in backup-mongodb.sh backup-minio.sh backup-redis.sh backup-vault.sh backup-consul.sh backup-all.sh; do
  if bash -n "$SCRIPT_DIR/$script" 2>/dev/null; then
    log "✓ $script syntax is valid"
    VALIDATIONS_PASSED=$((VALIDATIONS_PASSED + 1))
  else
    log "✗ $script has syntax errors"
    VALIDATIONS_FAILED=$((VALIDATIONS_FAILED + 1))
  fi
  VALIDATIONS_RUN=$((VALIDATIONS_RUN + 1))
done

# Test restore script syntax
log "Testing restore script syntax..."
if bash -n "$SCRIPT_DIR/restore.sh" 2>/dev/null; then
  log "✓ restore.sh syntax is valid"
  VALIDATIONS_PASSED=$((VALIDATIONS_PASSED + 1))
else
  log "✗ restore.sh has syntax errors"
  VALIDATIONS_FAILED=$((VALIDATIONS_FAILED + 1))
fi
VALIDATIONS_RUN=$((VALIDATIONS_RUN + 1))

# Check backup age
log "Checking backup freshness..."
LATEST_BACKUP_TIME=$(restic snapshots --json 2>/dev/null | jq -r '.[-1].time' 2>/dev/null | date -d - +%s 2>/dev/null || echo "0")
CURRENT_TIME=$(date +%s)
BACKUP_AGE_HOURS=$(( (CURRENT_TIME - LATEST_BACKUP_TIME) / 3600 ))

if [ $BACKUP_AGE_HOURS -lt 25 ]; then
  log "✓ Latest backup is recent ($BACKUP_AGE_HOURS hours old)"
  VALIDATIONS_PASSED=$((VALIDATIONS_PASSED + 1))
elif [ $BACKUP_AGE_HOURS -lt 49 ]; then
  log "⚠ Latest backup is somewhat old ($BACKUP_AGE_HOURS hours old)"
  VALIDATIONS_PASSED=$((VALIDATIONS_PASSED + 1))  # Still count as passed but warn
else
  log "✗ Latest backup is too old ($BACKUP_AGE_HOURS hours old)"
  VALIDATIONS_FAILED=$((VALIDATIONS_FAILED + 1))
fi
VALIDATIONS_RUN=$((VALIDATIONS_RUN + 1))

# Check disk space
log "Checking available disk space..."
BACKUP_DISK_FREE=$(df "$BACKUP_DIR" 2>/dev/null | tail -1 | awk '{print $4}' || echo "0")
BACKUP_DISK_FREE_GB=$((BACKUP_DISK_FREE / 1024 / 1024))

if [ $BACKUP_DISK_FREE_GB -gt 10 ]; then
  log "✓ Sufficient disk space available (${BACKUP_DISK_FREE_GB}GB free)"
  VALIDATIONS_PASSED=$((VALIDATIONS_PASSED + 1))
else
  log "✗ Low disk space (${BACKUP_DISK_FREE_GB}GB free)"
  VALIDATIONS_FAILED=$((VALIDATIONS_FAILED + 1))
fi
VALIDATIONS_RUN=$((VALIDATIONS_RUN + 1))

# Summary
echo ""
echo "=========================================="
echo "Validation Summary:"
echo -e "Validations run: $VALIDATIONS_RUN"
echo -e "Validations passed: ${GREEN}$VALIDATIONS_PASSED${NC}"
echo -e "Validations failed: ${RED}$VALIDATIONS_FAILED${NC}"
echo "Completed at: $(date)"
echo "=========================================="

# Exit with appropriate code
if [ $VALIDATIONS_FAILED -eq 0 ]; then
  log "✓ All validations passed!"
  exit 0
else
  FAILURE_RATE=$(( (VALIDATIONS_FAILED * 100) / VALIDATIONS_RUN ))
  log "✗ $VALIDATIONS_FAILED validation(s) failed (${FAILURE_RATE}% failure rate)"
  exit 1
fi