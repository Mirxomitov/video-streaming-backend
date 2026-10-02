#!/usr/bin/env bash
# Lightweight uptime check + self-heal. Runs from cron every 5 min on the prod server.
# Logs to ~/monitor.log; restarts the api container if /health is not 200.
set -uo pipefail
LOG="$HOME/monitor.log"
TS="$(date -Is)"
api=$(curl -s -o /dev/null -w "%{http_code}" https://stream.medic24.tj/health        --max-time 10 || echo 000)
cdn=$(curl -s -o /dev/null -w "%{http_code}" https://cdn.medic24.tj/minio/health/live --max-time 10 || echo 000)
disk=$(df -h / | awk "NR==2{print \$5}")
echo "$TS api=$api cdn=$cdn disk=$disk" >> "$LOG"
if [ "$api" != "200" ]; then
  echo "$TS api unhealthy ($api) -> restart" >> "$LOG"
  cd "$HOME/videostream" && docker compose -f docker-compose.prod.yaml restart api >> "$LOG" 2>&1
fi
# cap log size
tail -n 2000 "$LOG" > "$LOG.tmp" 2>/dev/null && mv "$LOG.tmp" "$LOG"
