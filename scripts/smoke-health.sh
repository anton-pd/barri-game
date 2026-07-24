#!/usr/bin/env bash
set -euo pipefail

base_url="${1:?Usage: $0 https://staging.barrigame.es}"
health_url="${base_url%/}/api/health"
body_file="$(mktemp)"
trap 'rm -f "${body_file}"' EXIT

status="$(curl \
  --silent \
  --show-error \
  --output "${body_file}" \
  --write-out '%{http_code}' \
  --retry 5 \
  --retry-delay 2 \
  --retry-connrefused \
  --connect-timeout 10 \
  --max-time 20 \
  "${health_url}")"

if [[ "${status}" != "200" ]]; then
  echo "Health smoke failed: ${health_url} returned HTTP ${status}" >&2
  cat "${body_file}" >&2
  exit 1
fi

python3 - "${body_file}" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as response:
    payload = json.load(response)

expected = {
    "status": "ok",
    "checks": {"database": "ok", "scenarios": "ok"},
}
if payload != expected:
    raise SystemExit(f"Health smoke failed: unexpected readiness JSON: {payload!r}")
PY

echo "Health smoke passed: ${health_url}"
