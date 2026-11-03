#!/usr/bin/env bash
#
# One-time setup of ELITE Real Estate on a fresh Ubuntu 24.04 server (Hostinger VPS).
# Copy this file to the server and run it as root:
#
#   bash setup.sh
#
# It installs Node.js, nginx, PM2 and HTTPS certificates; creates the `elite` user and
# /opt/elite; connects to GitHub with a read-only deploy key; writes the settings (with fresh
# secrets) once; builds and starts both apps; asks for the first admin account; and sets up a
# firewall and nightly backups. Running it again is safe: settings, data and keys are kept.
# Full guide: HOSTING.md.
#
set -euo pipefail

ELITE_HOME=${ELITE_HOME:-/opt/elite}
ELITE_USER=${ELITE_USER:-elite}
NODE_MAJOR=22
SHARED=$ELITE_HOME/shared
CONF=$SHARED/deploy.env

say() { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31m✖ %s\033[0m\n' "$*" >&2; exit 1; }
ask() { local answer; read -r -p "$1${2:+ [$2]}: " answer </dev/tty; echo "${answer:-${2:-}}"; }
as_app() { sudo -u "$ELITE_USER" -H env ELITE_HOME="$ELITE_HOME" "$@"; }
secret() { openssl rand -hex 32; }

[ "$(id -u)" = 0 ] || die "Run as root: sudo bash setup.sh"
# shellcheck source=/dev/null
. /etc/os-release
[ "${ID:-}" = ubuntu ] || echo "Note: made for Ubuntu 24.04 (this is ${PRETTY_NAME:-unknown}); continuing."

# ── Settings (asked once, kept in shared/deploy.env) ──
mkdir -p "$SHARED"
# shellcheck source=/dev/null
[ -f "$CONF" ] && . "$CONF"
if [ -z "${DOMAIN:-}" ]; then
  say "A few questions (Enter keeps the suggestion)"
  DOMAIN=$(ask "Website domain, without www" "eliterealestate.qa")
  APP_DOMAIN=$(ask "Agent app domain" "app.$DOMAIN")
  LE_EMAIL=$(ask "Your e-mail (HTTPS certificate notices)")
  REPO=$(ask "GitHub repository" "git@github.com:louai617/EliteWebsite.git")
  BRANCH=$(ask "Branch to deploy" "main")
  cat >"$CONF" <<EOF
DOMAIN="$DOMAIN"
APP_DOMAIN="$APP_DOMAIN"
LE_EMAIL="$LE_EMAIL"
REPO="$REPO"
BRANCH="$BRANCH"
EOF
fi

# ── System packages ──
say "Installing system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl ca-certificates gnupg git openssh-client nginx certbot python3-certbot-nginx ufw build-essential rsync sqlite3 openssl
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt "$NODE_MAJOR" ]; then
  say "Installing Node.js $NODE_MAJOR"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi
command -v pm2 >/dev/null || npm install -g pm2@7 --no-fund --no-audit
# The app user (via sudo) and cron only search the standard folders.
for bin in node npm npx pm2; do
  case "$(command -v "$bin")" in /usr/bin/* | /usr/local/bin/*) ;; *) ln -sf "$(command -v "$bin")" "/usr/local/bin/$bin" ;; esac
done

# Building the apps needs more memory than a small VPS has: add 2 GB of swap once.
if ! swapon --show | grep -q .; then
  say "Adding 2 GB swap"
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
fi

# ── App user and folders ──
id -u "$ELITE_USER" >/dev/null 2>&1 || useradd --create-home --shell /bin/bash "$ELITE_USER"
mkdir -p "$ELITE_HOME/releases" "$SHARED"/{data,storage,backups,logs}
chown -R "$ELITE_USER:$ELITE_USER" "$ELITE_HOME"

# ── GitHub access (read-only deploy key) ──
say "Connecting to GitHub"
key=/home/$ELITE_USER/.ssh/id_ed25519
[ -f "$key" ] || as_app bash -c "mkdir -p ~/.ssh && chmod 700 ~/.ssh && ssh-keygen -t ed25519 -N '' -C 'elite-server' -f ~/.ssh/id_ed25519 -q"
as_app bash -c "ssh-keyscan -t ed25519 github.com 2>/dev/null >> ~/.ssh/known_hosts; sort -u -o ~/.ssh/known_hosts ~/.ssh/known_hosts"
until as_app git ls-remote --heads "$REPO" "$BRANCH" 2>/dev/null | grep -q .; do
  cat <<EOF

The server can't read $REPO (branch $BRANCH) yet. On GitHub open the repository →
Settings → Deploy keys → Add deploy key, paste this key, leave "Allow write access" OFF:

$(cat "$key.pub")

EOF
  read -r -p "Press Enter once it's added (or Ctrl+C to stop)… " </dev/tty
done
if [ -d "$ELITE_HOME/src/.git" ]; then
  as_app git -C "$ELITE_HOME/src" remote set-url origin "$REPO"
  as_app git -C "$ELITE_HOME/src" fetch --quiet origin "$BRANCH"
  as_app git -C "$ELITE_HOME/src" reset --quiet --hard FETCH_HEAD
else
  as_app git clone --quiet --branch "$BRANCH" "$REPO" "$ELITE_HOME/src"
fi

# ── Settings files (written once; secrets are generated here and never leave the server) ──
if [ ! -f "$SHARED/backend.env" ]; then
  say "Writing settings with new secrets"
  revalidate=$(secret)
  cat >"$SHARED/backend.env" <<EOF
# Agent app settings (see backend/.env.example for every option). After editing: elite update
DATABASE_URL="file:$SHARED/data/elite.db"
SESSION_SECRET="$(secret)"
NEXT_PUBLIC_BUSINESS_TIMEZONE="Asia/Qatar"
APP_URL="https://$APP_DOMAIN"
CLIENT_APP_URL="https://$DOMAIN"
CORS_ORIGINS="https://$DOMAIN,https://www.$DOMAIN"
WEBSITE_REVALIDATE_SECRET="$revalidate"
WEBSITE_REVALIDATE_URL="http://127.0.0.1:3001/api/revalidate"

# E-mail (password reset codes, booking and reservation e-mails). Hostinger e-mail:
# SMTP_HOST="smtp.hostinger.com", SMTP_PORT="465", SMTP_SECURE="true", user = full address.
SMTP_HOST=""
SMTP_PORT="465"
SMTP_SECURE="true"
SMTP_USER=""
SMTP_PASS=""
MAIL_FROM="ELITE Real Estate <no-reply@$DOMAIN>"

SCHEDULER_ENABLED="true"
CRON_SECRET=""
EOF
  cat >"$SHARED/website.env" <<EOF
# Website settings. NEXT_PUBLIC_ values are built in: after editing run elite update.
NEXT_PUBLIC_API_URL=https://$APP_DOMAIN/api
NEXT_PUBLIC_CRM_URL=https://$APP_DOMAIN
NEXT_PUBLIC_SITE_URL=https://$DOMAIN
API_INTERNAL_URL=http://127.0.0.1:3002/api
REVALIDATE_SECRET=$revalidate
NEXT_PUBLIC_BUSINESS_TIMEZONE=Asia/Qatar
EOF
fi
chown "$ELITE_USER:$ELITE_USER" "$SHARED/backend.env" "$SHARED/website.env"
chmod 600 "$SHARED/backend.env" "$SHARED/website.env"

# ── Server commands, nightly backup, log rotation, start on boot ──
install -m 755 "$ELITE_HOME/src/deploy/elite" /usr/local/bin/elite
cat >/etc/cron.d/elite-backup <<EOF
# Nightly backup at 03:30 Doha time (00:30 UTC). See deploy/backup.sh.
PATH=/usr/local/bin:/usr/bin:/bin
30 0 * * * $ELITE_USER ELITE_HOME=$ELITE_HOME bash $ELITE_HOME/src/deploy/backup.sh >> $SHARED/logs/backup.log 2>&1
EOF
cat >/etc/logrotate.d/elite <<EOF
$SHARED/logs/*.log {
  daily
  rotate 14
  compress
  missingok
  notifempty
  copytruncate
}
EOF
env PATH="$PATH" pm2 startup systemd -u "$ELITE_USER" --hp "/home/$ELITE_USER" >/dev/null

# ── nginx ──
say "Configuring nginx"
install -m 644 "$ELITE_HOME/src/deploy/nginx/elite-proxy.conf" /etc/nginx/snippets/elite-proxy.conf
if ! grep -q "managed by Certbot" /etc/nginx/sites-available/elite 2>/dev/null; then
  sed -e "s/__DOMAIN__/$DOMAIN/g" -e "s/__APP_DOMAIN__/$APP_DOMAIN/g" "$ELITE_HOME/src/deploy/nginx/elite.conf.template" >/etc/nginx/sites-available/elite
  # Servers without IPv6 can't listen on [::].
  [ -f /proc/net/if_inet6 ] || sed -i '/listen \[::\]/d' /etc/nginx/sites-available/elite
fi
ln -sfn /etc/nginx/sites-available/elite /etc/nginx/sites-enabled/elite
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx >/dev/null 2>&1 || true
systemctl reload nginx

# ── Firewall: SSH, HTTP and HTTPS only ──
ufw allow OpenSSH >/dev/null
ufw allow 'Nginx Full' >/dev/null
ufw --force enable >/dev/null

# ── Build and start ──
say "Building and starting the apps (takes a few minutes)"
elite update

say "Admin account"
elite run --silent admin:create -- --if-missing

say "HTTPS"
elite https || echo "Run 'elite https' again once the DNS records point to this server."

cat <<EOF

✓ Done.
  Website:    https://$DOMAIN
  Agent app:  https://$APP_DOMAIN/login

  Next: fill in the SMTP settings in $SHARED/backend.env, then run: elite update
  Commands:   elite (shows the list) · elite update · elite logs · elite status
EOF
