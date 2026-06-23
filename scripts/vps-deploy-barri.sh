#!/usr/bin/env bash
set -euo pipefail

target="${1:-}"

case "${target}" in
  staging)
    repo_dir="/opt/apps/barri-dev"
    branch="staging"
    service="barri-dev"
    container="apps-barri-dev-1"
    ;;
  production)
    repo_dir="/opt/apps/barri"
    branch="main"
    service="barri"
    container="apps-barri-1"
    ;;
  *)
    echo "Usage: $0 {staging|production}" >&2
    exit 64
    ;;
esac

echo "[deploy] target=${target} repo=${repo_dir} branch=${branch} service=${service}"

cd "${repo_dir}"

current_branch="$(git branch --show-current)"
if [[ "${current_branch}" != "${branch}" ]]; then
  echo "[deploy] Refusing deploy: ${repo_dir} is on ${current_branch}, expected ${branch}" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "[deploy] Refusing deploy: ${repo_dir} has uncommitted changes" >&2
  git status --short
  exit 1
fi

git fetch origin "${branch}"
git pull --ff-only origin "${branch}"

cd /opt/apps
env -u ANTHROPIC_API_KEY docker compose --env-file /opt/apps/.env -f docker-compose.yml up -d --build "${service}"
docker compose --env-file /opt/apps/.env -f docker-compose.yml ps "${service}"
docker logs --tail=80 "${container}"

echo "[deploy] complete target=${target}"
