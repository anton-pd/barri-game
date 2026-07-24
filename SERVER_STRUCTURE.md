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

## Shared scenario mutation maintenance

Source scenario JSON is shared by staging and production, so runtime mutation is **off by default**. Reading scenarios and generating image/audio cache files remain available in both environments.

For a short, controlled production-only admin maintenance window, add both values to `/opt/apps/.env`, then recreate the production `barri` service:

```text
SCENARIO_MUTATIONS_ENABLED=true
SCENARIO_MUTATIONS_ALLOWED_HOST=barrigame.es
```

The exact host allowlist means the shared environment still rejects mutations through `staging.barrigame.es` with `403 scenario_mutations_forbidden`. Without both values, mutations return `503 scenario_mutations_disabled` before any source JSON or generated materials are written. Immediately remove the two values (or set `SCENARIO_MUTATIONS_ENABLED=false`) and recreate `barri` after maintenance. Do not enable this for normal staging or gameplay use.

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

## Auto-Deploy

GitHub Actions deploys Barri automatically through `.github/workflows/deploy.yml`:

- Push/merge to `staging` deploys `/opt/apps/barri-dev` and rebuilds `barri-dev` (`staging.barrigame.es`).
- Push/merge to `main` deploys `/opt/apps/barri` and rebuilds `barri` (`barrigame.es`).
- Manual runs are available from GitHub Actions via `workflow_dispatch` with `staging` or `production`.

The workflow connects to the VPS with a dedicated restricted SSH key. The key is forced through `/opt/apps/vps-deploy-barri-ssh.sh`, which only accepts `deploy staging` and `deploy production`, then delegates to `/opt/apps/vps-deploy-barri.sh`.

Required GitHub repository secrets:

- `VPS_SSH_HOST`
- `VPS_SSH_USER`
- `VPS_SSH_PORT`
- `VPS_DEPLOY_SSH_KEY`
- `VPS_SSH_KNOWN_HOSTS`

## Manual Deploy Fallback

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
