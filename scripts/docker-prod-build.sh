#!/usr/bin/env bash
# Build production stack tuần tự — tránh Docker Bake export song song cùng tag / hủy lẫn nhau.
# Chạy từ thư mục gốc repo:
#   bash scripts/docker-prod-build.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-quanluong-app-be/.env.docker}"
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod-ui.yml --env-file "$ENV_FILE")

echo "[prod-build] backend (migrate service — tag quanluong-backend:latest)"
"${COMPOSE[@]}" build migrate

echo "[prod-build] UI web"
"${COMPOSE[@]}" build ui

echo "[prod-build] UI superadmin"
"${COMPOSE[@]}" build ui-superadmin

echo "[prod-build] xong. Khởi động: ${COMPOSE[*]} up -d"
