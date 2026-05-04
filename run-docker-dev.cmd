@echo off
setlocal
title Quan Luong - Docker dev stack
set "DOCKERBIN=C:\Program Files\Docker\Docker\resources\bin"
if exist "%DOCKERBIN%\docker.exe" set "PATH=%DOCKERBIN%;%PATH%"
cd /d "%~dp0"

echo.
echo Khoi dong Docker Compose (API + DB + Redis + UI)...
echo Thu muc: %CD%
echo.

docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file quanluong-app-be/.env.docker up --build

echo.
echo Da dung (hoac loi). Bam phim bat ky de dong cua so.
pause >nul
