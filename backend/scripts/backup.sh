#!/bin/bash
# ==========================================================
# CAPSTONE SOFTWARE SOLUTIONS LTD
# Script: backup.sh
# Purpose: PostgreSQL database backup for Capstone production
# ==========================================================

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_NAME="${DB_NAME:-capstone}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
S3_BUCKET="${S3_BUCKET:-}"
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Create backup directory
mkdir -p "${BACKUP_DIR}"

# Backup filename
BACKUP_FILE="${BACKUP_DIR}/capstone_${TIMESTAMP}.sql.gz"
BACKUP_INFO="${BACKUP_DIR}/capstone_${TIMESTAMP}.json"

log_info "Starting database backup: ${DB_NAME}@${DB_HOST}:${DB_PORT}"

# Perform pg_dump
if PGPASSWORD="${DB_PASSWORD:-}" pg_dump \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    --no-owner \
    --no-acl \
    --format=custom \
    --compress=9 \
    --verbose \
    --file="${BACKUP_FILE}" 2>&1; then
    
    BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
    log_info "Backup completed successfully: ${BACKUP_FILE} (${BACKUP_SIZE})"
    
    # Write backup metadata
    cat > "${BACKUP_INFO}" << EOF
{
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "database": "${DB_NAME}",
    "host": "${DB_HOST}",
    "file": "${BACKUP_FILE}",
    "size": "${BACKUP_SIZE}",
    "status": "success"
}
EOF
    
    # Upload to S3 if configured
    if [ -n "${S3_BUCKET}" ]; then
        log_info "Uploading to S3: ${S3_BUCKET}/database/${BACKUP_FILE##*/}"
        if aws s3 cp "${BACKUP_FILE}" "${S3_BUCKET}/database/" --only-show-errors; then
            log_info "S3 upload successful"
        else
            log_warn "S3 upload failed"
        fi
    fi
    
    # Send Slack notification if configured
    if [ -n "${SLACK_WEBHOOK_URL}" ]; then
        curl -s -X POST "${SLACK_WEBHOOK_URL}" \
            -H "Content-Type: application/json" \
            -d "{
                \"text\": \"✅ Capstone database backup completed\nDatabase: ${DB_NAME}\nSize: ${BACKUP_SIZE}\nFile: ${BACKUP_FILE}\"
            }" > /dev/null 2>&1 || true
    fi
else
    log_error "Backup failed"
    
    if [ -n "${SLACK_WEBHOOK_URL}" ]; then
        curl -s -X POST "${SLACK_WEBHOOK_URL}" \
            -H "Content-Type: application/json" \
            -d "{
                \"text\": \"❌ Capstone database backup FAILED\nDatabase: ${DB_NAME}\"
            }" > /dev/null 2>&1 || true
    fi
    
    exit 1
fi

# Cleanup old backups
log_info "Cleaning up backups older than ${RETENTION_DAYS} days"
find "${BACKUP_DIR}" -name "capstone_*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete
find "${BACKUP_DIR}" -name "capstone_*.json" -mtime "+${RETENTION_DAYS}" -delete

log_info "Backup process completed"