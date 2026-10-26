# Hosting on Hostinger

Both apps run on one **Hostinger VPS** (a virtual server you control):

| Address | What | Runs on the server as |
| --- | --- | --- |
| `https://eliterealestate.qa` (and `www.`) | Public website | `elite-website`, port 3001 |
| `https://app.eliterealestate.qa` | Agent app (CRM + API) | `elite-agent-app`, port 3002 |

nginx receives the visitors and handles HTTPS (free Let's Encrypt certificates, renewed
automatically). PM2 keeps both apps running and restarts them after a crash or a reboot.

**Why a VPS and not Hostinger's "Node.js web app" hosting (Business / Cloud plans)?** The agent
app keeps its database and every uploaded photo, original, video and document on the server's
disk, and it runs a background scheduler (midnight rollover, the 24-hour lead rule, the
watermark job). Hostinger's managed Node.js hosting replaces the app's files on every deploy and
isn't meant for that. A VPS keeps everything, and the scripts in `deploy/` set it up for you.

---

## 1. Buy the VPS

In Hostinger: **VPS → choose a plan**.

- **KVM 2** (2 CPU, 8 GB RAM) is recommended. **KVM 1** (4 GB) also works — the setup adds
  swap memory so the apps can be built — but updates take longer.
- **Location:** the closest one to Qatar in the list.
- **Operating system:** plain **Ubuntu 24.04** (no control panel, no app template).
- Choose a strong **root password** and keep it safe.
- If backups are offered for the VPS, turn them on (they protect against losing the server; the
  nightly backups below live on the server itself).

When it's ready, note its **IP address** (hPanel → VPS → Overview).

## 2. Point the domain to the server

Where `eliterealestate.qa` is managed (your domain registrar's DNS settings), create three
**A records**, each pointing to the VPS IP address:

| Name / Host | Type | Value |
| --- | --- | --- |
| `@` (the domain itself) | A | the VPS IP |
| `www` | A | the VPS IP |
| `app` | A | the VPS IP |

Remove any older A records for the same names. Changes can take from a few minutes to a few
hours to spread; HTTPS is switched on once they have (step 4 retries for you).

## 3. Put the code on `main`

The server deploys the `main` branch. On GitHub, open the pull request with the latest work,
press **Ready for review**, then **Merge**. (To deploy another branch, answer its name in step 4.)

## 4. Run the setup (once, about 15 minutes)

On your Mac, in Terminal:

```bash
cd "/Users/djeddilouai/Desktop/untitled folder/EliteWebsite"
git pull
scp deploy/setup.sh root@YOUR_SERVER_IP:     # copies the setup script (asks for the root password)
ssh root@YOUR_SERVER_IP                       # logs in to the server
bash setup.sh
```

It asks a few questions — press Enter to keep a suggestion:

1. **Website domain** → `eliterealestate.qa`
2. **Agent app domain** → `app.eliterealestate.qa`
3. **Your e-mail** → for HTTPS certificate notices
4. **GitHub repository** → Enter
5. **Branch** → `main`

Then it shows a line starting with `ssh-ed25519 …` — the server's key for reading the code.
On GitHub: **repository → Settings → Deploy keys → Add deploy key**, title "Hostinger
server", paste the line, leave **Allow write access** off, **Add key**. Back in the terminal,
press Enter.

The script then installs everything, builds both apps (5–10 minutes) and asks for the **first
admin account**: your name, a real e-mail address (password-reset codes go there) and a
password (10+ characters with upper and lower case and a number; it isn't shown while you type).

At the end it switches on HTTPS. If the DNS records from step 2 aren't active yet, it says so —
run `elite https` later. Open **https://app.eliterealestate.qa** and sign in.

Nothing to configure by hand: the settings files are written for you, with new random secrets
that never leave the server (`/opt/elite/shared/backend.env` and `website.env`).

## 5. E-mail (password codes, booking and reservation e-mails)

The agent app sends e-mail through an SMTP mailbox, e.g. `no-reply@eliterealestate.qa`
(Hostinger Email, Google Workspace or Microsoft 365). On the server:

```bash
nano /opt/elite/shared/backend.env
```

Fill in the `SMTP_` lines. With Hostinger Email:

```bash
SMTP_HOST="smtp.hostinger.com"
SMTP_PORT="465"
SMTP_SECURE="true"
SMTP_USER="no-reply@eliterealestate.qa"
SMTP_PASS="the mailbox password"
MAIL_FROM="ELITE Real Estate <no-reply@eliterealestate.qa>"
```

Save (Ctrl+O, Enter, Ctrl+X), run `elite restart`, then in the agent app: **Settings → E-mail →
Send me a test e-mail**.

## 6. Everyday use

Log in with `ssh root@YOUR_SERVER_IP`, then:

| Command | What it does |
| --- | --- |
| `elite update` | Deploys the latest `main` from GitHub. The new version is built next to the live one; the site keeps running and only switches over if the build succeeds and the apps start. Database changes are applied automatically (with a copy of the database first). |
| `elite rollback` | Goes back to the previous version. |
| `elite status` | Shows whether both apps are online. |
| `elite logs` | Recent log lines (`elite logs elite-agent-app` for one app). |
| `elite restart` | Restarts both apps, e.g. after editing `backend.env`. |
| `elite stop` | Stops both apps (start them again with `elite restart`). |
| `elite admin` | Adds an admin, or resets an admin's password (if you're locked out). |
| `elite run db:clear-demo` | Runs an agent-app command, here: show / remove demo data. |
| `elite backup` | Makes a backup now. |
| `elite https` | Gets or renews the HTTPS certificate (renewal is also automatic). |

So the usual flow for a change is: merge it on GitHub → `ssh root@…` → `elite update`.

Editing `website.env` (the website's `NEXT_PUBLIC_` values) needs `elite update` rather than
`elite restart`, because those values are built into the website.

## 7. Backups

Every night at 03:30 (Doha time) the server copies the database and all uploaded files to
`/opt/elite/shared/backups/daily/<date>/` and keeps 14 days. Unchanged photos aren't copied
again, so this takes little space. Before each update the database is also copied to
`/opt/elite/shared/backups/before-<version>.db`.

These copies are on the same server. Now and then, download the latest one to your Mac:

```bash
rsync -a root@YOUR_SERVER_IP:/opt/elite/shared/backups/daily/latest/ ./elite-backup-$(date +%F)/
```

**Restoring** a backup (on the server):

```bash
ls /opt/elite/shared/backups/daily/          # pick a date
elite stop
cp /opt/elite/shared/backups/daily/2026-10-20/elite.db /opt/elite/shared/data/elite.db
rsync -a --delete /opt/elite/shared/backups/daily/2026-10-20/storage/ /opt/elite/shared/storage/
chown -R elite:elite /opt/elite/shared
elite restart
```

## 8. Starting with the data from your Mac (optional)

The setup starts with an empty database and the admin you create. To bring over what's on your
Mac instead (listings, photos, team, settings):

```bash
# On the Mac, in backend/
npm run db:backup                                  # makes backups/dev-<time>.db
ssh root@YOUR_SERVER_IP "elite stop"
scp backups/dev-<time>.db root@YOUR_SERVER_IP:/opt/elite/shared/data/elite.db
rsync -a storage/ root@YOUR_SERVER_IP:/opt/elite/shared/storage/
ssh root@YOUR_SERVER_IP "chown -R elite:elite /opt/elite/shared && elite update"
```

The accounts come along with their passwords: sign in with the Mac's admin and change the
password and e-mail (Users → ✎) if they were development ones.

## 9. Security

- Only SSH (22), HTTP (80) and HTTPS (443) are open (ufw firewall). The apps listen on the
  server itself and are reached only through nginx.
- HTTP redirects to HTTPS; the login cookie is HTTPS-only and stays on `app.`.
- Secrets live only in `/opt/elite/shared/*.env` (readable by the app user only), generated on
  the server.
- Sign-in attempts are rate-limited per real visitor IP (nginx passes it on and visitors can't
  fake it).
- Use a strong root password (or an SSH key) and keep Ubuntu updated now and then:
  `apt update && apt upgrade -y` (Ubuntu installs security updates by itself by default).

## 10. Troubleshooting

| Problem | Fix |
| --- | --- |
| Setup keeps showing the `ssh-ed25519` key | The deploy key isn't added to *this* repository yet (Settings → Deploy keys), or the repository / branch name is wrong — answers are kept in `/opt/elite/shared/deploy.env`; edit it and run `bash setup.sh` again. |
| `elite https` says a name doesn't point here | The DNS records from step 2 aren't active yet or point elsewhere. Check with `getent hosts app.eliterealestate.qa` (should print the VPS IP), wait, try again. |
| The site shows "502 Bad Gateway" | An app isn't running: `elite status`, then `elite logs`. `elite rollback` if it started after an update. |
| `elite update` says the build failed | Nothing changed on the live site. The lines above the message show why; on KVM 1 a build can run out of memory — try again, or move to KVM 2. |
| No e-mails arrive | Check the `SMTP_` lines (step 5), `elite restart`, and Settings → E-mail in the agent app (each attempt is listed). |
| Locked out of the agent app | `elite admin`, enter the admin's e-mail, answer `y`, choose a new password. |
| Running the setup again | Safe: it keeps the settings, secrets, data and keys, and updates the server configuration. |
