#!/usr/bin/env bash
# Daily backup: MongoDB dump + MinIO object store. Keeps last 7 of each.
# Installed on the prod server; run by cron at 03:00. Restore notes in PROGRESS.md.
set -euo pipefail
BK="$HOME/backups"
TS="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BK"

# MongoDB: compressed archive of the videostream db
docker exec videostream-mongo-1 mongodump --archive --gzip --db videostream > "$BK/mongo-$TS.archive.gz"

# MinIO: tar of the data volume (all buckets/objects)
docker run --rm -v videostream_minio-data:/data:ro -v "$BK":/backup alpine \
  tar czf "/backup/minio-$TS.tar.gz" -C /data .

# Retention: keep newest 7
ls -1t "$BK"/mongo-*.archive.gz 2>/dev/null | tail -n +8 | xargs -r rm -f
ls -1t "$BK"/minio-*.tar.gz     2>/dev/null | tail -n +8 | xargs -r rm -f

echo "[$(date -Is)] backup ok: mongo-$TS.archive.gz $(du -h "$BK/mongo-$TS.archive.gz" | cut -f1), minio-$TS.tar.gz $(du -h "$BK/minio-$TS.tar.gz" | cut -f1)"
