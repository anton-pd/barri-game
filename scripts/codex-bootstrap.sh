#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "== Barri Codex bootstrap =="

ENV_LOCAL="$ROOT/.env.linear.local"
ENV_FALLBACK_LOCAL="/Users/anton.leshchenko/Projects/Barri/.env.linear.local"
ENV_FALLBACK_VPS="/opt/apps/.env"

if [[ ! -e "$ENV_LOCAL" ]]; then
  if [[ -f "$ENV_FALLBACK_LOCAL" ]]; then
    ln -s "$ENV_FALLBACK_LOCAL" "$ENV_LOCAL"
    echo "linked .env.linear.local -> $ENV_FALLBACK_LOCAL"
  elif [[ -f "$ENV_FALLBACK_VPS" ]]; then
    ln -s "$ENV_FALLBACK_VPS" "$ENV_LOCAL"
    echo "linked .env.linear.local -> $ENV_FALLBACK_VPS"
  else
    echo "warning: no Linear env file found"
  fi
else
  echo "env: .env.linear.local present"
fi

if [[ ! -x node_modules/.bin/next || ! -x node_modules/.bin/eslint ]]; then
  echo "deps: installing with npm ci"
  npm ci
else
  echo "deps: node_modules ready"
fi

echo "linear:"
npm run --silent linear -- viewer --json

echo "repo:"
npm run --silent repo:doctor || true

echo "ready"
