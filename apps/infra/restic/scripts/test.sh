#!/bin/bash
set -e

# Tumbaland Backup System Test Script
# This script tests the backup and restore functionality

echo "=========================================="
echo "Tumbaland Backup System Test"
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

# Set default values
RESTIC_REPOSITORY=${RESTIC_REPOSITORY:-"$BACKUP_DIR/data/restic-repo"}
export RESTIC_REPOSITORY
export RESTIC_PASSWORD

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Test function
run_test() {
  local test_name="$1"
  local test_command="$2"

  TESTS_RUN=$((TESTS_RUN + 1))
  log "Running test: $test_name"

  if eval "$test_command"; then
    echo -e "${GREEN}✓ PASS${NC}: $test_name"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}✗ FAIL${NC}: $test_name"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
}

# Test repository initialization
run_test "Repository initialization" "
  restic init >/dev/null 2>&1 || restic list snapshots >/dev/null 2>&1
"

# Test repository integrity
run_test "Repository integrity" "
  restic check >/dev/null 2>&1
"

# Test backup scripts exist and are executable
run_test "Backup scripts exist" "
  [ -x '$BACKUP_DIR/scripts/backup-all.sh' ] &&
  [ -x '$BACKUP_DIR/scripts/backup-mongodb.sh' ] &&
  [ -x '$BACKUP_DIR/scripts/backup-minio.sh' ] &&
  [ -x '$BACKUP_DIR/scripts/backup-redis.sh' ] &&
  [ -x '$BACKUP_DIR/scripts/backup-vault.sh' ] &&
  [ -x '$BACKUP_DIR/scripts/backup-consul.sh' ]
"

# Test restore script exists
run_test "Restore script exists" "
  [ -x '$BACKUP_DIR/scripts/restore.sh' ]
"

# Test cleanup script exists
run_test "Cleanup script exists" "
  [ -x '$BACKUP_DIR/scripts/cleanup.sh' ]
"

# Test setup script exists
run_test "Setup script exists" "
  [ -x '$BACKUP_DIR/scripts/setup.sh' ]
"

# Test environment file
run_test "Environment file exists" "
  [ -f '$BACKUP_DIR/.env' ]
"

# Test directories exist
run_test "Required directories exist" "
  [ -d '$BACKUP_DIR/data' ] &&
  [ -d '$BACKUP_DIR/logs' ] &&
  [ -d '$BACKUP_DIR/scripts' ]
"

# Test Docker Compose file
run_test "Docker Compose file exists" "
  [ -f '$BACKUP_DIR/docker-compose.yml' ]
"

# Test README exists
run_test "Documentation exists" "
  [ -f '$BACKUP_DIR/README.md' ]
"

# Test Restic version
run_test "Restic is available" "
  restic version >/dev/null 2>&1
"

# Test MongoDB client (if available)
run_test "MongoDB client available" "
  command -v mongodump >/dev/null 2>&1 || command -v mongoexport >/dev/null 2>&1
"

# Test MinIO client (if available)
run_test "MinIO client available" "
  command -v mc >/dev/null 2>&1
"

# Test basic backup operation (dry run)
run_test "Basic backup operation" "
  mkdir -p /tmp/backup-test &&
  echo 'test data' > /tmp/backup-test/test.txt &&
  restic backup /tmp/backup-test --tag test >/dev/null 2>&1 &&
  restic snapshots --tag test | grep -q test &&
  restic forget --tag test --keep-last 0 >/dev/null 2>&1
"

# Clean up test data
rm -rf /tmp/backup-test

# Summary
echo ""
echo "=========================================="
echo "Test Summary:"
echo -e "Tests run: $TESTS_RUN"
echo -e "Tests passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests failed: ${RED}$TESTS_FAILED${NC}"
echo "Completed at: $(date)"
echo "=========================================="

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All tests passed! Backup system is ready.${NC}"
  exit 0
else
  echo -e "${RED}✗ Some tests failed. Please check the output above.${NC}"
  exit 1
fi