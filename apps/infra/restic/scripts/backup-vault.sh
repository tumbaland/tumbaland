#!/bin/bash
set -e

echo "Starting Vault backup..."

# Configuration
VAULT_ADDR=${VAULT_ADDR:-http://vault:8200}
VAULT_TOKEN=${VAULT_TOKEN:-${VAULT_DEV_ROOT_TOKEN_ID}}
BACKUP_DIR="/backup/vault"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Check Vault status
echo "Checking Vault status..."
vault status || echo "Vault status check failed - may not be initialized"

# Export Vault data (if possible)
echo "Attempting to export Vault data..."
if vault token lookup >/dev/null 2>&1; then
  # Get list of secrets engines
  echo "Getting secrets engines..."
  vault secrets list > "$BACKUP_DIR/secrets_engines_$TIMESTAMP.txt" 2>/dev/null || true

  # Get auth methods
  echo "Getting auth methods..."
  vault auth list > "$BACKUP_DIR/auth_methods_$TIMESTAMP.txt" 2>/dev/null || true

  # Get policies
  echo "Getting policies..."
  vault policy list > "$BACKUP_DIR/policies_$TIMESTAMP.txt" 2>/dev/null || true

  # For each policy, get the policy content
  if [ -f "$BACKUP_DIR/policies_$TIMESTAMP.txt" ]; then
    mkdir -p "$BACKUP_DIR/policies_$TIMESTAMP"
    while IFS= read -r policy; do
      if [ -n "$policy" ] && [ "$policy" != "default" ]; then
        vault policy read "$policy" > "$BACKUP_DIR/policies_$TIMESTAMP/$policy.hcl" 2>/dev/null || true
      fi
    done < "$BACKUP_DIR/policies_$TIMESTAMP.txt"
  fi

  # Note: Full secret data export is not recommended for security
  # Instead, we backup the encrypted storage
else
  echo "Vault token not valid - skipping policy export"
fi

# Backup Vault data files (encrypted storage)
echo "Backing up Vault data files..."
cp -r /backup/vault/data "$BACKUP_DIR/data_$TIMESTAMP"
cp -r /backup/vault/logs "$BACKUP_DIR/logs_$TIMESTAMP"
cp -r /backup/vault/config "$BACKUP_DIR/config_$TIMESTAMP"

# Add to restic repository
echo "Adding Vault backup to restic..."
restic backup "$BACKUP_DIR/data_$TIMESTAMP" "$BACKUP_DIR/logs_$TIMESTAMP" "$BACKUP_DIR/config_$TIMESTAMP" \
  --tag vault \
  --tag "$TIMESTAMP"

# Clean up local backup files (keep only last 2 - more conservative for security)
echo "Cleaning up old local backups..."
cd "$BACKUP_DIR"
ls -t data_* | tail -n +3 | xargs -r rm -rf
ls -t logs_* | tail -n +3 | xargs -r rm -rf
ls -t config_* | tail -n +3 | xargs -r rm -rf
ls -t secrets_engines_*.txt | tail -n +3 | xargs -r rm -f
ls -t auth_methods_*.txt | tail -n +3 | xargs -r rm -f
ls -t policies_*.txt | tail -n +3 | xargs -r rm -f
ls -t policies_* | tail -n +3 | xargs -r rm -rf

echo "Vault backup completed successfully"
echo "WARNING: Vault backups contain sensitive encrypted data. Store securely and test restores."