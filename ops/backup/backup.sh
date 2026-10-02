#!/bin/bash
# Đêm: MariaDB + Postgres chứng từ + snapshot Qdrant + bản media theo ngày.
# Nén SQL bằng zstd. Ảnh/xlsx và snapshot Qdrant không nén lại.
# Drive (rclone crypt) giữ KEEP_COUNT bản mới nhất. Khôi phục ghi đè tại chỗ, không tắt app.
# Sau mỗi lần backup, ghi phiếu để app gửi email cho superadmin.
# ponytail: trong lúc khôi phục request đang mở có thể lỗi; pool tự nối lại. Muốn im tuyệt đối thì mới cần cửa sổ bảo trì.
set -euo pipefail

KEEP_COUNT="${KEEP_COUNT:-10}"
LOG="${BACKUP_LOG:-/var/backups/quanluong/backup.log}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/quanluong}"
LOCK="${BACKUP_LOCK:-${BACKUP_DIR}/backup.lock}"
RCLONE_REMOTE="${RCLONE_REMOTE:-gdrive-crypt}"
QDRANT_URL="${QDRANT_URL:-http://qdrant:6333}"

log() {
  install -d -m 755 "$(dirname "$LOG")"
  printf '%s %s\n' "$(date -Is)" "$*" | tee -a "$LOG"
}

valid_date() {
  [[ ${1:-} =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]
}

# stdin: tên đã sort cũ → mới. In những dòng cần xoá để còn đúng $1 bản.
prune_keep() {
  local keep="$1"
  mapfile -t lines
  local n=${#lines[@]} extra i
  extra=$((n - keep))
  ((extra > 0)) || return 0
  for ((i = 0; i < extra; i++)); do
    printf '%s\n' "${lines[$i]}"
  done
}

json_bool() {
  if [[ -n ${1:-} ]]; then printf true; else printf false; fi
}

notify_superadmin() {
  local ok="$1" day="$2" detail="$3" tmp esc
  esc=${detail//\\/\\\\}
  esc=${esc//\"/\\\"}
  esc=${esc//$'\n'/ }
  install -d -m 755 "$BACKUP_DIR/requests" || return 0
  tmp="$(mktemp "$BACKUP_DIR/requests/.notify.XXXXXX")" || return 0
  printf '{"ok":%s,"day":"%s","detail":"%s","at":"%s"}\n' \
    "$ok" "$day" "$esc" "$(date -Is)" >"$tmp" || {
    rm -f "$tmp"
    return 0
  }
  mv "$tmp" "$BACKUP_DIR/requests/notify.json" || return 0
  log "đã xếp email cho superadmin"
}

write_status() {
  local state="$1" day="$2" message="$3" tmp
  message=${message//\\/\\\\}
  message=${message//\"/\\\"}
  tmp="$(mktemp "$BACKUP_DIR/.status.XXXXXX")"
  printf '{"state":"%s","date":"%s","message":"%s","at":"%s"}\n' \
    "$state" "$day" "$message" "$(date -Is)" >"$tmp"
  mv "$tmp" "$BACKUP_DIR/status.json"
}

have_drive() {
  [[ -n ${RCLONE_CONFIG:-} && -f "$RCLONE_CONFIG" ]]
}

qdrant_curl() {
  local -a hdr=()
  if [[ -n ${QDRANT_API_KEY:-} ]]; then
    hdr=(-H "api-key: ${QDRANT_API_KEY}")
  fi
  curl -fsS "${hdr[@]}" "$@"
}

client_cnf() {
  local file="$1"
  chmod 600 "$file"
  {
    printf '%s\n' '[client]'
    printf 'host=%s\n' "${DB_HOST:-db}"
    printf 'user=%s\n' "${DB_USER:-root}"
    printf 'password="%s"\n' "${DB_PASSWORD//\"/\\\"}"
  } >"$file"
}

pg_env() {
  local file="$1"
  chmod 600 "$file"
  local pass="${PGPASSWORD//\\/\\\\}"
  pass="${pass//:/\\:}"
  printf '%s:5432:%s:%s:%s\n' "${PGHOST}" "${PGDATABASE}" "${PGUSER}" "$pass" >"$file"
  export PGPASSFILE="$file"
  unset PGPASSWORD
}

require_db_env() {
  : "${DB_HOST:=db}"
  : "${DB_USER:=root}"
  DB_PASSWORD="${DB_PASSWORD:-${DB_ROOT_PASSWORD:-}}"
  : "${DB_NAME:?DB_NAME trống}"
  : "${PGHOST:?PGHOST trống}"
  : "${PGUSER:?PGUSER trống}"
  : "${PGDATABASE:?PGDATABASE trống}"
  : "${PGPASSWORD:?PGPASSWORD trống}"
  : "${MEDIA_DIR:=/data/media}"
  if [[ -z "$DB_PASSWORD" ]]; then
    log "BACKUP_FAILED thiếu mật khẩu DB"
    if [[ ${BACKUP_NOTIFY:-} == 1 ]]; then
      notify_superadmin false "${day:-}" "Backup lỗi: thiếu mật khẩu DB."
    fi
    exit 1
  fi
}

write_manifest() {
  local -A db=() doc=() qd=() media=() seen=()
  local d name f drive=false
  shopt -s nullglob
  for f in "$BACKUP_DIR"/db/db_*.sql.zst; do
    name="$(basename "$f")"
    d="${name#db_}"
    d="${d%.sql.zst}"
    valid_date "$d" || continue
    db[$d]=1
    seen[$d]=1
  done
  for f in "$BACKUP_DIR"/document/document_*.sql.zst; do
    name="$(basename "$f")"
    d="${name#document_}"
    d="${d%.sql.zst}"
    valid_date "$d" || continue
    doc[$d]=1
    seen[$d]=1
  done
  for f in "$BACKUP_DIR"/qdrant/qdrant_*.snapshot; do
    name="$(basename "$f")"
    d="${name#qdrant_}"
    d="${d%.snapshot}"
    valid_date "$d" || continue
    qd[$d]=1
    seen[$d]=1
  done
  if have_drive; then
    drive=true
    export RCLONE_CONFIG
    while IFS= read -r name; do
      [[ "$name" == db_*.sql.zst ]] || continue
      d="${name#db_}"
      d="${d%.sql.zst}"
      valid_date "$d" || continue
      db[$d]=1
      seen[$d]=1
    done < <(rclone lsf "${RCLONE_REMOTE}:db" --files-only 2>/dev/null || true)
    while IFS= read -r name; do
      [[ "$name" == document_*.sql.zst ]] || continue
      d="${name#document_}"
      d="${d%.sql.zst}"
      valid_date "$d" || continue
      doc[$d]=1
      seen[$d]=1
    done < <(rclone lsf "${RCLONE_REMOTE}:document" --files-only 2>/dev/null || true)
    while IFS= read -r name; do
      [[ "$name" == qdrant_*.snapshot ]] || continue
      d="${name#qdrant_}"
      d="${d%.snapshot}"
      valid_date "$d" || continue
      qd[$d]=1
      seen[$d]=1
    done < <(rclone lsf "${RCLONE_REMOTE}:qdrant" --files-only 2>/dev/null || true)
    while IFS= read -r name; do
      d="${name%/}"
      valid_date "$d" || continue
      media[$d]=1
      seen[$d]=1
    done < <(rclone lsf "${RCLONE_REMOTE}:media" --dirs-only 2>/dev/null || true)
  fi

  local tmp dates=() first=1 bytes
  tmp="$(mktemp "$BACKUP_DIR/.manifest.XXXXXX")"
  if ((${#seen[@]})); then
    mapfile -t dates < <(printf '%s\n' "${!seen[@]}" | sort -r)
  fi
  {
    printf '{\n  "updatedAt": "%s",\n  "keep": %s,\n  "driveReady": %s,\n  "versions": [\n' \
      "$(date -Is)" "$KEEP_COUNT" "$drive"
    for d in "${dates[@]}"; do
      bytes=0
      for f in \
        "$BACKUP_DIR/db/db_${d}.sql.zst" \
        "$BACKUP_DIR/document/document_${d}.sql.zst" \
        "$BACKUP_DIR/qdrant/qdrant_${d}.snapshot"
      do
        if [[ -f "$f" ]]; then
          bytes=$((bytes + $(wc -c <"$f")))
        fi
      done
      if [[ $first -eq 0 ]]; then
        printf ',\n'
      fi
      first=0
      printf '    {"date":"%s","db":%s,"document":%s,"qdrant":%s,"media":%s,"bytes":%s}' \
        "$d" "$(json_bool "${db[$d]:-}")" "$(json_bool "${doc[$d]:-}")" \
        "$(json_bool "${qd[$d]:-}")" "$(json_bool "${media[$d]:-}")" "$bytes"
    done
    if ((${#dates[@]})); then
      printf '\n'
    fi
    printf '  ]\n}\n'
  } >"$tmp"
  mv "$tmp" "$BACKUP_DIR/manifest.json"
}

prune_local() {
  local dir="$1" pattern="$2" name
  local -a names=()
  [[ -d "$dir" ]] || return 0
  mapfile -t names < <(find "$dir" -maxdepth 1 -type f -name "$pattern" -printf '%f\n' | sort)
  ((${#names[@]})) || return 0
  while IFS= read -r name; do
    [[ -n "$name" ]] || continue
    rm -f "$dir/$name"
    log "xoá cục bộ $name"
  done < <(printf '%s\n' "${names[@]}" | prune_keep "$KEEP_COUNT")
}

prune_remote_files() {
  local remote_dir="$1" name
  local -a names=()
  mapfile -t names < <(rclone lsf "$remote_dir" --files-only | sort || true)
  ((${#names[@]})) || return 0
  while IFS= read -r name; do
    [[ -n "$name" ]] || continue
    rclone deletefile "${remote_dir}/${name}"
    log "xoá Drive ${remote_dir}/${name}"
  done < <(printf '%s\n' "${names[@]}" | prune_keep "$KEEP_COUNT")
}

prune_remote_days() {
  local remote_dir="$1" name
  local -a names=()
  mapfile -t names < <(rclone lsf "$remote_dir" --dirs-only | sed 's:/$::' | grep -E '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' | sort || true)
  ((${#names[@]})) || return 0
  while IFS= read -r name; do
    [[ -n "$name" ]] || continue
    rclone purge "${remote_dir}/${name}"
    log "xoá Drive ${remote_dir}/${name}"
  done < <(printf '%s\n' "${names[@]}" | prune_keep "$KEEP_COUNT")
}

dump_all() {
  local day="$1"
  # Subshell để trap EXIT không đè trap của job, và không xoá PGPASSWORD của shell cha.
  (
    set -euo pipefail
    local cnf pgpass partial snap_name
    install -d -m 700 "$BACKUP_DIR/db" "$BACKUP_DIR/document" "$BACKUP_DIR/qdrant"
    cnf="$(mktemp)"
    pgpass="$(mktemp)"
    partial=""
    snap_name=""
    trap 'rm -f "$partial" ${cnf:+"$cnf"} ${pgpass:+"$pgpass"}; if [[ -n ${snap_name:-} ]]; then qdrant_curl -X DELETE "${QDRANT_URL}/snapshots/${snap_name}" >/dev/null || true; fi' EXIT

    client_cnf "$cnf"
  partial="$BACKUP_DIR/db/db_${day}.sql.zst.partial"
  rm -f "$partial"
  mariadb-dump \
    --defaults-extra-file="$cnf" \
    --single-transaction \
    --routines \
    --triggers \
    --databases "$DB_NAME" \
    | zstd -T0 -q -o "$partial"
  mv "$partial" "$BACKUP_DIR/db/db_${day}.sql.zst"
  partial=""
  rm -f "$cnf"
  cnf=""
  log "dump MariaDB xong db_${day}.sql.zst"

  pg_env "$pgpass"
  partial="$BACKUP_DIR/document/document_${day}.sql.zst.partial"
  rm -f "$partial"
  pg_dump \
    --host="$PGHOST" \
    --username="$PGUSER" \
    --dbname="$PGDATABASE" \
    --clean \
    --if-exists \
    --no-owner \
    --no-acl \
    --format=plain \
    | zstd -T0 -q -o "$partial"
  mv "$partial" "$BACKUP_DIR/document/document_${day}.sql.zst"
  partial=""
  rm -f "$pgpass"
  pgpass=""
  log "dump Postgres xong document_${day}.sql.zst"

  snap_name="$(qdrant_curl -X POST "${QDRANT_URL}/snapshots" | sed -n 's/.*"name":"\([^"]*\)".*/\1/p')"
  [[ "$snap_name" =~ ^[A-Za-z0-9._-]+$ ]] || {
    log "BACKUP_FAILED snapshot Qdrant không đọc được tên"
    exit 1
  }
  partial="$BACKUP_DIR/qdrant/qdrant_${day}.snapshot.partial"
  rm -f "$partial"
  qdrant_curl -o "$partial" "${QDRANT_URL}/snapshots/${snap_name}"
  qdrant_curl -X DELETE "${QDRANT_URL}/snapshots/${snap_name}" >/dev/null
  snap_name=""
    mv "$partial" "$BACKUP_DIR/qdrant/qdrant_${day}.snapshot"
    partial=""
    log "snapshot Qdrant xong qdrant_${day}.snapshot"
  )
}

upload_all() {
  local day="$1"
  export RCLONE_CONFIG
  rclone mkdir "${RCLONE_REMOTE}:db"
  rclone mkdir "${RCLONE_REMOTE}:document"
  rclone mkdir "${RCLONE_REMOTE}:qdrant"
  rclone mkdir "${RCLONE_REMOTE}:media/${day}"
  rclone copy "$BACKUP_DIR/db/db_${day}.sql.zst" "${RCLONE_REMOTE}:db"
  rclone copy "$BACKUP_DIR/document/document_${day}.sql.zst" "${RCLONE_REMOTE}:document"
  rclone copy "$BACKUP_DIR/qdrant/qdrant_${day}.snapshot" "${RCLONE_REMOTE}:qdrant"
  rclone check "$BACKUP_DIR/db" "${RCLONE_REMOTE}:db" --size-only --one-way --include "db_${day}.sql.zst"
  rclone check "$BACKUP_DIR/document" "${RCLONE_REMOTE}:document" --size-only --one-way --include "document_${day}.sql.zst"
  rclone check "$BACKUP_DIR/qdrant" "${RCLONE_REMOTE}:qdrant" --size-only --one-way --include "qdrant_${day}.snapshot"
  if [[ ! -d "$MEDIA_DIR" ]]; then
    log "BACKUP_FAILED không thấy media $MEDIA_DIR"
    exit 1
  fi
  rclone copy "$MEDIA_DIR" "${RCLONE_REMOTE}:media/${day}"
  rclone check "$MEDIA_DIR" "${RCLONE_REMOTE}:media/${day}" --size-only --one-way
  prune_remote_files "${RCLONE_REMOTE}:db"
  prune_remote_files "${RCLONE_REMOTE}:document"
  prune_remote_files "${RCLONE_REMOTE}:qdrant"
  prune_remote_days "${RCLONE_REMOTE}:media"
  if rclone lsf "${RCLONE_REMOTE}:old" --dirs-only >/dev/null 2>&1; then
    rclone purge "${RCLONE_REMOTE}:old" || true
  fi
}

ensure_file() {
  local local_path="$1" remote_dir="$2" name="$3"
  if [[ -f "$local_path" ]]; then
    if have_drive; then
      export RCLONE_CONFIG
      rclone check "$(dirname "$local_path")" "${RCLONE_REMOTE}:${remote_dir}" --size-only --one-way --include "$name"
    fi
    return 0
  fi
  have_drive || {
    log "BACKUP_FAILED thiếu $name và chưa có Drive"
    return 1
  }
  export RCLONE_CONFIG
  rclone copy "${RCLONE_REMOTE}:${remote_dir}/${name}" "$(dirname "$local_path")"
  [[ -f "$local_path" ]] || {
    log "BACKUP_FAILED không tải được $name"
    return 1
  }
  rclone check "$(dirname "$local_path")" "${RCLONE_REMOTE}:${remote_dir}" --size-only --one-way --include "$name"
}

do_backup() {
  local day
  day="$(date +%F)"
  BACKUP_NOTIFY=1
  require_db_env
  exec 9>"$LOCK"
  if ! flock -n 9; then
    log "BACKUP_FAILED lock bận"
    notify_superadmin false "$day" "Backup ngày $day không chạy vì lần trước chưa xong."
    exit 1
  fi
  trap 'notify_superadmin false "$day" "Backup ngày $day lỗi. Xem log backup trên server."; log "BACKUP_FAILED exit=$? line=$LINENO"' ERR
  log "backup bắt đầu day=$day"
  dump_all "$day"
  if ! have_drive; then
    prune_local "$BACKUP_DIR/db" 'db_*.sql.zst'
    prune_local "$BACKUP_DIR/document" 'document_*.sql.zst'
    prune_local "$BACKUP_DIR/qdrant" 'qdrant_*.snapshot'
    write_manifest
    log "BACKUP_FAILED thiếu $RCLONE_CONFIG"
    notify_superadmin false "$day" "Backup ngày $day lỗi: chưa có rclone.conf. File mới chỉ nằm trên máy."
    exit 1
  fi
  upload_all "$day"
  prune_local "$BACKUP_DIR/db" 'db_*.sql.zst'
  prune_local "$BACKUP_DIR/document" 'document_*.sql.zst'
  prune_local "$BACKUP_DIR/qdrant" 'qdrant_*.snapshot'
  write_manifest
  notify_superadmin true "$day" "Backup ngày $day đã lên Drive. Giữ ${KEEP_COUNT} bản gần nhất."
  log "backup xong"
}

do_restore() {
  require_db_env
  local req="$BACKUP_DIR/requests/restore.json" day cnf="" pgpass=""
  [[ -f "$req" ]] || exit 0
  day="$(sed -n 's/.*"date"[[:space:]]*:[[:space:]]*"\([0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}\)".*/\1/p' "$req" | head -1)"
  rm -f "$req"
  if ! valid_date "$day"; then
    write_status failed "" "Ngày khôi phục không hợp lệ"
    log "BACKUP_FAILED ngày khôi phục không hợp lệ"
    exit 1
  fi
  write_status running "$day" "Đang chờ lượt khôi phục"
  exec 9>"$LOCK"
  if ! flock -w 7200 9; then
    write_status failed "$day" "Không lấy được lock"
    exit 1
  fi
  cleanup_restore() { rm -f ${cnf:+"$cnf"} ${pgpass:+"$pgpass"}; }
  trap 'cleanup_restore; write_status failed "'"$day"'" "Khôi phục lỗi, xem backup.log"; log "BACKUP_FAILED restore exit=$? line=$LINENO"' ERR
  log "khôi phục bắt đầu day=$day"
  write_status running "$day" "Đang lấy bản $day"
  install -d -m 700 "$BACKUP_DIR/db" "$BACKUP_DIR/document" "$BACKUP_DIR/qdrant"
  ensure_file "$BACKUP_DIR/db/db_${day}.sql.zst" db "db_${day}.sql.zst"
  ensure_file "$BACKUP_DIR/document/document_${day}.sql.zst" document "document_${day}.sql.zst"
  ensure_file "$BACKUP_DIR/qdrant/qdrant_${day}.snapshot" qdrant "qdrant_${day}.snapshot"
  have_drive || {
    write_status failed "$day" "Media theo ngày chỉ có trên Drive"
    log "BACKUP_FAILED media cần Drive"
    exit 1
  }
  export RCLONE_CONFIG
  rclone lsf "${RCLONE_REMOTE}:media" --dirs-only | grep -qx "${day}/" || {
    write_status failed "$day" "Drive không có media ngày $day"
    log "BACKUP_FAILED không có media/$day"
    exit 1
  }

  write_status running "$day" "Đang khôi phục MariaDB"
  cnf="$(mktemp)"
  client_cnf "$cnf"
  zstd -dc "$BACKUP_DIR/db/db_${day}.sql.zst" | mariadb --defaults-extra-file="$cnf"
  rm -f "$cnf"
  cnf=""

  write_status running "$day" "Đang khôi phục Postgres chứng từ"
  pgpass="$(mktemp)"
  pg_env "$pgpass"
  psql --host="$PGHOST" --username="$PGUSER" --dbname="$PGDATABASE" -v ON_ERROR_STOP=1 \
    -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid();" \
    >/dev/null
  zstd -dc "$BACKUP_DIR/document/document_${day}.sql.zst" | psql --host="$PGHOST" --username="$PGUSER" --dbname="$PGDATABASE" -v ON_ERROR_STOP=1 >/dev/null
  rm -f "$pgpass"
  pgpass=""

  write_status running "$day" "Đang khôi phục Qdrant"
  qdrant_curl -X POST "${QDRANT_URL}/snapshots/upload?priority=snapshot" \
    -F "snapshot=@${BACKUP_DIR}/qdrant/qdrant_${day}.snapshot;type=application/octet-stream" \
    >/dev/null

  write_status running "$day" "Đang khôi phục media"
  rclone sync "${RCLONE_REMOTE}:media/${day}" "$MEDIA_DIR"
  write_status ok "$day" "Đã tạo lại dữ liệu ngày $day"
  log "khôi phục xong day=$day"
}

watch_loop() {
  install -d -m 755 "$BACKUP_DIR/requests" "$(dirname "$LOG")" /var/lock
  set +e
  while true; do
    if [[ -f "$BACKUP_DIR/requests/restore.json" ]]; then
      "$0" restore
    fi
    "$0" manifest
    sleep 20
  done
}

self_check() {
  local tmp out n oldest
  tmp="$(mktemp -d)"
  printf '%s\n' 2026-01-01 2026-01-02 2026-01-03 2026-01-04 2026-01-05 \
    2026-01-06 2026-01-07 2026-01-08 2026-01-09 2026-01-10 2026-01-11 2026-01-12 \
    | prune_keep 10 >"$tmp/drop"
  n="$(wc -l <"$tmp/drop" | tr -d ' ')"
  [[ "$n" == 2 ]] || {
    echo "SELF_CHECK_FAIL count=$n"
    exit 1
  }
  oldest="$(head -1 "$tmp/drop")"
  [[ "$oldest" == 2026-01-01 ]] || {
    echo "SELF_CHECK_FAIL oldest=$oldest"
    exit 1
  }
  out="$(printf '' | prune_keep 10 | wc -l | tr -d ' ')"
  [[ "$out" == 0 ]] || {
    echo "SELF_CHECK_FAIL empty=$out"
    exit 1
  }
  valid_date 2026-10-03 || exit 1
  valid_date 2026-10-3 && exit 1
  rm -rf "$tmp"
  echo SELF_CHECK_OK
}

cmd="${1:-backup}"
case "$cmd" in
  self-check) self_check ;;
  manifest)
    install -d -m 755 "$BACKUP_DIR"
    write_manifest
    ;;
  watch) watch_loop ;;
  restore) do_restore ;;
  backup) do_backup ;;
  *)
    echo "lệnh không hỗ trợ: $cmd" >&2
    exit 1
    ;;
esac
