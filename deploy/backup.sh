#!/usr/bin/env bash
#
# Daily backup on the server (cron, see deploy/setup.sh; by hand: elite backup).
#
#   shared/backups/daily/<date>/elite.db   a consistent copy of the database (safe while running)
#   shared/backups/daily/<date>/storage/   photos, originals, videos and documents — unchanged
#                                          files are hard links to the day before, so each day
#                                          only costs the space of what changed
#
# Kept 14 days. These copies live on the same server: also keep Hostinger's VPS backups on,
# and now and then download a copy (see HOSTING.md).
#
set -euo pipefail

ELITE_HOME=${ELITE_HOME:-/opt/elite}
DAILY=$ELITE_HOME/shared/backups/daily
KEEP_DAYS=14
day=$(date +%F)
dest=$DAILY/$day

cd "$ELITE_HOME"
mkdir -p "$dest"
(cd "$ELITE_HOME/current/backend" && node scripts/backup-db.mjs "$dest/elite.db")

link_dest=()
[ -d "$DAILY/latest/storage" ] && link_dest=(--link-dest="$DAILY/latest/storage")
rsync -a --delete "${link_dest[@]}" "$ELITE_HOME/shared/storage/" "$dest/storage/"
ln -sfn "$dest" "$DAILY/latest"

find "$DAILY" -mindepth 1 -maxdepth 1 -type d -name '20*' -mtime +"$KEEP_DAYS" -exec rm -rf {} +
echo "$(date -Is) backup ok: $dest ($(du -sh "$dest" | cut -f1))"
