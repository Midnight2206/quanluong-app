#!/usr/bin/env bash
# Chạy trước `migrate deploy` (Docker service migrate). Các bước tùy chọn bỏ qua lỗi kỳ vọng;
# bước cuối `prisma migrate deploy` phải thành công (set -e).
set -euo pipefail
cd /app

log() { echo "[migrate-recover] $*"; }

log "optional: migrate resolve 20100 (thường lỗi vì không còn thư mục migration trên disk — bỏ qua)"
set +e
npm run prisma:migrate:resolve -- --applied "20260330120100_meal_roster_meal_allowance_rate_fk" 2>&1
rc=$?
set -e
if [ "$rc" -ne 0 ]; then
  log "resolve 20100 exited $rc (bỏ qua)"
fi

log "optional: migrate resolve 30000 (khi bản ghi lỗi trùng tên với thư mục hiện tại)"
set +e
npm run prisma:migrate:resolve -- --applied "20260330130000_meal_roster_meal_allowance_rate_fk" 2>&1
rc=$?
set -e
if [ "$rc" -ne 0 ]; then
  log "resolve 30000 exited $rc (bỏ qua — sẽ thử SQL recovery)"
fi

if [ -f "prisma/recovery/rename-meal-roster-migration-metadata.sql" ]; then
  log "optional: đổi tên bản ghi _prisma_migrations 20100 → 30000 nếu còn"
  set +e
  npx prisma db execute --file prisma/recovery/rename-meal-roster-migration-metadata.sql 2>&1
  rc=$?
  set -e
  if [ "$rc" -ne 0 ]; then
    log "db execute exited $rc (bỏ qua — chưa có bảng hoặc không có dòng khớp)"
  fi
fi

log "prisma migrate deploy"
npm run prisma:migrate:deploy
