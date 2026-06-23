# Codex Ops Quick Runbook

Use this when a cloud/dev Codex needs a short-lived VPS-side helper for deploys, logs, Docker, disk checks, or live runtime data inspection.

## Role split

- **Codex Dev** runs in a cloud/local clean checkout, changes code, runs tests, commits, opens PRs, and keeps GitHub as the source of truth.
- **Codex Ops** runs on `vps1` only when live server context is needed: deploys, container logs, Docker Compose status, disk pressure, Caddy/runtime checks, and `/opt/apps/shared_data` inspection.
- Do **not** use Codex Ops for long-running feature development or uncommitted production edits.

## VPS source map

- Staging checkout: `/opt/apps/barri-dev` on branch `staging`.
- Production checkout: `/opt/apps/barri` on branch `main`.
- Shared compose/env root: `/opt/apps/docker-compose.yml` and `/opt/apps/.env`.
- Shared runtime data: `/opt/apps/shared_data/scenarios` and `/opt/apps/shared_data/public/scenarios`.

Live scenario JSON is read from the shared data mount, not from repo `scenarios/` folders.

## How Codex Dev should call Codex Ops

Send a narrow request with:

1. **Target environment**: `staging`, `production`, or `both`.
2. **Goal**: deploy, inspect logs, check disk, verify live scenario data, etc.
3. **Exact branch/commit expected**: for example `origin/staging` after PR merge.
4. **Safe commands allowed**: prefer read-only commands unless deploy is explicitly requested.
5. **Output needed**: concise summary, command results, and any risks.

Example:

```text
Codex Ops task:
Target: staging
Goal: deploy the latest origin/staging and verify container health.
Expected source: /opt/apps/barri-dev, branch staging, fast-forward only.
Run the documented deploy command, then report git HEAD, docker compose ps, and last 80 app log lines if unhealthy.
Do not edit files manually.
```

## Standard read-only checks

```bash
cd /opt/apps/barri-dev && git status --short --branch && git rev-parse --short HEAD
cd /opt/apps/barri && git status --short --branch && git rev-parse --short HEAD
cd /opt/apps && docker compose --env-file /opt/apps/.env -f docker-compose.yml ps
docker logs --tail=100 apps-barri-dev-1
docker logs --tail=100 apps-barri-1
df -h /
docker system df
du -xhd1 /var/log /opt/apps /var/lib/docker 2>/dev/null | sort -h
```

## Staging deploy

```bash
cd /opt/apps/barri-dev \
  && git pull --ff-only origin staging \
  && cd /opt/apps \
  && env -u ANTHROPIC_API_KEY docker compose --env-file /opt/apps/.env -f docker-compose.yml up -d --build barri-dev
```

After deploy:

```bash
cd /opt/apps/barri-dev && git status --short --branch && git rev-parse --short HEAD
cd /opt/apps && docker compose --env-file /opt/apps/.env -f docker-compose.yml ps barri-dev
docker logs --tail=100 apps-barri-dev-1
```

## Production deploy

Only run after staging has been verified and `main` is ready.

```bash
cd /opt/apps/barri \
  && git pull --ff-only origin main \
  && cd /opt/apps \
  && env -u ANTHROPIC_API_KEY docker compose --env-file /opt/apps/.env -f docker-compose.yml up -d --build barri
```

After deploy:

```bash
cd /opt/apps/barri && git status --short --branch && git rev-parse --short HEAD
cd /opt/apps && docker compose --env-file /opt/apps/.env -f docker-compose.yml ps barri
docker logs --tail=100 apps-barri-1
```

## Live scenario/data inspection

Use this only for runtime data checks. Do not treat these files as normal code changes.

```bash
find /opt/apps/shared_data/scenarios -maxdepth 1 -type f -name '*.json' -printf '%f\n' | sort
find /opt/apps/shared_data/public/scenarios -maxdepth 2 -type f | head -100
```

If a live scenario change must become canonical, copy it back into the Git repo in Codex Dev, review the diff, commit it, and deploy through the normal staging/main flow.

## Guardrails

- Prefer `git pull --ff-only`; do not create merge commits on the VPS deployment checkouts.
- Never manually edit `/opt/apps/barri` for production hotfixes unless Anton explicitly asks and the change is immediately committed/pushed through Git.
- Never print secrets from `/opt/apps/.env`; only check whether required variable names exist.
- Do not delete files in `/opt/apps/shared_data` without an explicit backup and Anton approval.
- If `tg-bot.service` or `/opt/tg-bot` reappears, treat it as deprecated cleanup work and follow `SERVER_STRUCTURE.md`.
