# Barri VPS Server Structure

Production and staging run on `vps1` under `/opt/apps`.

## Active Barri Layout

```text
/opt/apps/
├── docker-compose.yml        # Shared compose file for prod, staging, Postgres, Caddy-adjacent services
├── .env                      # VPS env source for Barri, Linear keys, DB credentials, AI keys
├── barri/                    # Production checkout, branch main
├── barri-dev/                # Staging checkout, branch staging
└── shared_data/              # Persistent data mounted into both Barri containers
    ├── scenarios/            # Live scenario JSON files
    └── public/scenarios/     # Generated/cached scenario images and dynamic assets
```

Barri runtime source of truth:
- `SCENARIOS_DIR=/app/scenarios`
- `/opt/apps/shared_data/scenarios` is mounted to `/app/scenarios` in both `barri-dev` and `barri`
- `/opt/apps/shared_data/public/scenarios` is mounted to `/app/public/scenarios` for generated/cached assets

Do not rely on repo checkout `scenarios/` inside `/opt/apps/barri*` as live data. The repo folder is only a local fallback/template set; live reads and admin saves go through `SCENARIOS_DIR`.

## Runtime Services

| Service | Owner | Purpose |
| --- | --- | --- |
| `apps-barri-1` | Docker Compose | Production app, exposed through Caddy as `https://barrigame.es`, internal port `3000` |
| `apps-barri-dev-1` | Docker Compose | Staging app, exposed through Caddy as `https://staging.barrigame.es`, internal port `3001` |
| `apps-postgres-1` | Docker Compose | Shared PostgreSQL container with separate DBs (`barri_prod`, `barri_dev`) |
| `hermes gateway run` | system service | Hermes agent/gateway; unrelated to Barri deploys and unrelated to Telegram bot cleanup |
| Directus | Docker/Node process | Separate service on the VPS; not part of the Barri app deploy path |

## Removed / Deprecated

`tg-bot.service` and `/opt/tg-bot` are deprecated and should not run.
The old Telegram polling bot used a revoked token, spammed `401 Unauthorized` request dumps into `/var/log/syslog`, and filled the disk.

If found active, remove it with:

```bash
sudo systemctl stop tg-bot.service
sudo systemctl disable tg-bot.service
sudo rm -f /etc/systemd/system/tg-bot.service
sudo systemctl daemon-reload
sudo rm -rf /opt/tg-bot
```

Then clean the oversized logs:

```bash
sudo truncate -s 0 /var/log/syslog /var/log/syslog.1
sudo journalctl --vacuum-size=300M
df -h /
```

## Deploy Commands

Staging:

```bash
ssh vps1 'cd /opt/apps/barri-dev && git pull --ff-only origin staging && cd /opt/apps && env -u ANTHROPIC_API_KEY docker compose --env-file /opt/apps/.env -f docker-compose.yml up -d --build barri-dev'
```

Production:

```bash
ssh vps1 'cd /opt/apps/barri && git pull --ff-only origin main && cd /opt/apps && env -u ANTHROPIC_API_KEY docker compose --env-file /opt/apps/.env -f docker-compose.yml up -d --build barri'
```

## Disk Checks

```bash
df -h /
docker system df
du -xhd1 /var/log /opt/apps /var/lib/docker 2>/dev/null | sort -h
```
