#!/usr/bin/env bash
#
# Deploys a new version of both apps on the server. Run it through the `elite` command:
#
#   elite update      build the latest code from GitHub and switch to it
#   elite rollback    switch back to the previous version
#
# Every version is built in its own folder (releases/<time>-<commit>) while the live one keeps
# running; only a version that built cleanly is switched to. If it doesn't start, the previous
# version is put back automatically. Data never lives in a release folder:
#
#   /opt/elite/
#     src/                 git checkout of the deployed branch (elite update refreshes it)
#     releases/<id>/       one folder per deployed version (the last 3 are kept)
#     current -> releases/<id>
#     shared/
#       backend.env        agent app settings and secrets   (→ backend/.env)
#       website.env        website settings                 (→ frontend/.env.local)
#       data/elite.db      the database
#       storage/           photos, originals, videos, documents (→ backend/storage)
#       backups/           database copies, daily backups    (→ backend/backups)
#       logs/
#
set -euo pipefail

ELITE_HOME=${ELITE_HOME:-/opt/elite}
SHARED=$ELITE_HOME/shared
KEEP_RELEASES=3

say() { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" != 0 ] || die "Run this as the app user (use: elite update)."
cd "$ELITE_HOME"
exec 9>"$ELITE_HOME/.deploy.lock"
flock -n 9 || die "Another update is running."

# Settings before the build (the website builds its NEXT_PUBLIC_ values in)…
link_settings() {
  ln -sfn "$SHARED/backend.env" "$1/backend/.env"
  ln -sfn "$SHARED/website.env" "$1/frontend/.env.local"
}
# …data only after it: the build must never look into uploaded files.
link_data() {
  ln -sfn "$SHARED/storage" "$1/backend/storage"
  ln -sfn "$SHARED/backups" "$1/backend/backups"
}

# Points `current` at a release atomically.
activate() {
  ln -sfn "$1" "$ELITE_HOME/current.next"
  mv -Tf "$ELITE_HOME/current.next" "$ELITE_HOME/current"
}

reload_apps() {
  export ELITE_HOME
  pm2 startOrReload "$ELITE_HOME/current/deploy/ecosystem.config.cjs" --update-env >/dev/null
  pm2 save >/dev/null
}

healthy() {
  for _ in $(seq 1 60); do
    if curl -fs -o /dev/null http://127.0.0.1:3002/api/health && curl -fs -o /dev/null http://127.0.0.1:3001/; then
      return 0
    fi
    sleep 2
  done
  return 1
}

releases_by_age() { find "$ELITE_HOME/releases" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort; }
current_release() { basename "$(readlink -f "$ELITE_HOME/current" 2>/dev/null || echo none)"; }

if [ "${1:-}" = "--rollback" ]; then
  now=$(current_release)
  prev=$(releases_by_age | awk -v now="$now" '$0 < now' | tail -n 1)
  [ -n "$prev" ] || die "There is no older version to go back to."
  say "Switching back from $now to $prev"
  activate "$ELITE_HOME/releases/$prev"
  reload_apps
  healthy || die "The previous version didn't start either — check: elite logs"
  say "Done. Running $prev ($(cat "$ELITE_HOME/releases/$prev/REVISION" 2>/dev/null))."
  exit 0
fi

[ -d "$ELITE_HOME/src/.git" ] || die "$ELITE_HOME/src is missing — run deploy/setup.sh first."
for f in backend.env website.env; do [ -f "$SHARED/$f" ] || die "$SHARED/$f is missing — run deploy/setup.sh first."; done
mkdir -p "$ELITE_HOME/releases" "$SHARED/data" "$SHARED/storage" "$SHARED/backups" "$SHARED/logs"

commit=$(git -C "$ELITE_HOME/src" rev-parse --short HEAD)
id="$(date +%Y%m%d-%H%M%S)-$commit"
rel="$ELITE_HOME/releases/$id"
previous=$(current_release)

say "Preparing version $id ($(git -C "$ELITE_HOME/src" log -1 --format=%s))"
mkdir -p "$rel"
git -C "$ELITE_HOME/src" archive HEAD | tar -x -C "$rel"
git -C "$ELITE_HOME/src" log -1 --format='%h %s (%ci)' > "$rel/REVISION"
link_settings "$rel"

build() {
  local dir=$1
  say "Installing and building $dir"
  (cd "$rel/$dir" && npm ci --include=dev --no-audit --no-fund --loglevel=error && npm run build)
}
if ! build backend || ! build frontend; then
  rm -rf "${rel:?}"
  die "The build failed — nothing was changed on the live site."
fi
link_data "$rel"

say "Updating the database"
db_file=$(sed -n 's/^DATABASE_URL="\{0,1\}file:\([^"]*\)"\{0,1\}$/\1/p' "$SHARED/backend.env")
if [ -n "$db_file" ] && [ -f "$db_file" ]; then
  (cd "$rel/backend" && node scripts/backup-db.mjs "$SHARED/backups/before-$id.db")
fi
(cd "$rel/backend" && npx --no-install prisma migrate deploy)

say "Switching to the new version"
activate "$rel"
reload_apps
if ! healthy; then
  if [ "$previous" != none ] && [ -d "$ELITE_HOME/releases/$previous" ]; then
    activate "$ELITE_HOME/releases/$previous"
    reload_apps
    die "The new version didn't start, so $previous is back online. See: elite logs"
  fi
  die "The apps didn't start. See: elite logs"
fi

# Keep the newest few releases (always the live one).
releases_by_age | head -n "-$KEEP_RELEASES" | while read -r old; do
  [ "$old" = "$id" ] || rm -rf "${ELITE_HOME:?}/releases/$old"
done
find "$SHARED/backups" -maxdepth 1 -name 'before-*.db' -mtime +30 -delete

say "Done. Live: $(cat "$rel/REVISION")"
