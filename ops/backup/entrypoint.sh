#!/bin/bash
# Cron không nhận env của container. Ghi file rồi source khi job chạy.
set -euo pipefail

install -d -m 755 \
  /var/backups/quanluong/db \
  /var/backups/quanluong/document \
  /var/backups/quanluong/qdrant \
  /var/backups/quanluong/requests \
  /var/lock

tz="${TZ:-Asia/Ho_Chi_Minh}"
if [[ -f "/usr/share/zoneinfo/${tz}" ]]; then
  ln -snf "/usr/share/zoneinfo/${tz}" /etc/localtime
  printf '%s\n' "$tz" >/etc/timezone
fi

umask 077
{
  printf 'TZ=%q\n' "$tz"
  printf 'DB_HOST=%q\n' "${DB_HOST:-db}"
  printf 'DB_USER=%q\n' "${DB_USER:-root}"
  printf 'DB_PASSWORD=%q\n' "${DB_PASSWORD:-${DB_ROOT_PASSWORD:-}}"
  printf 'DB_NAME=%q\n' "${DB_NAME:-quanluong}"
  printf 'MEDIA_DIR=%q\n' "${MEDIA_DIR:-/data/media}"
  printf 'BACKUP_DIR=%q\n' "${BACKUP_DIR:-/var/backups/quanluong}"
  printf 'RCLONE_CONFIG=%q\n' "${RCLONE_CONFIG:-/config/rclone.conf}"
  printf 'RCLONE_REMOTE=%q\n' "${RCLONE_REMOTE:-gdrive-crypt}"
  printf 'BACKUP_LOG=%q\n' "${BACKUP_LOG:-/var/backups/quanluong/backup.log}"
  printf 'PGHOST=%q\n' "${PGHOST:-document-db}"
  printf 'PGUSER=%q\n' "${PGUSER:-document}"
  printf 'PGPASSWORD=%q\n' "${PGPASSWORD:-${DOCUMENT_DB_PASSWORD:-}}"
  printf 'PGDATABASE=%q\n' "${PGDATABASE:-${DOCUMENT_DB_NAME:-document}}"
  printf 'QDRANT_URL=%q\n' "${QDRANT_URL:-http://qdrant:6333}"
  printf 'KEEP_COUNT=%q\n' "${KEEP_COUNT:-10}"
  if [[ -n ${QDRANT_API_KEY:-} ]]; then
    printf 'QDRANT_API_KEY=%q\n' "$QDRANT_API_KEY"
  fi
} >/etc/quanluong-backup.env
chmod 600 /etc/quanluong-backup.env

if [[ ! -f "${RCLONE_CONFIG:-/config/rclone.conf}" ]]; then
  echo "$(date -Is) chưa có rclone.conf — job đêm sẽ lỗi cho đến khi cấu hình Drive superadmin" >&2
fi

/opt/backup/backup.sh watch &
exec cron -f
