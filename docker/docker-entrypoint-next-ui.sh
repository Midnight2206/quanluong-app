#!/bin/sh
set -e

# Next standalone đọc HOSTNAME để bind; Docker gán HOSTNAME = id container → ghi đè để lắng nghe mọi interface.
export HOSTNAME=0.0.0.0
export PORT="${PORT:-3000}"

case "${NEXT_UI_APP:-web}" in
  superadmin)
    node /app/apps/superadmin/server.js &
    ;;
  *)
    node /app/apps/web/server.js &
    ;;
esac

exec nginx -g "daemon off;"
