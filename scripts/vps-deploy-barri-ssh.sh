#!/usr/bin/env bash
set -euo pipefail

case "${SSH_ORIGINAL_COMMAND:-}" in
  "deploy staging")
    exec /opt/apps/vps-deploy-barri.sh staging
    ;;
  "deploy production")
    exec /opt/apps/vps-deploy-barri.sh production
    ;;
  *)
    echo "Denied command: ${SSH_ORIGINAL_COMMAND:-<empty>}" >&2
    exit 64
    ;;
esac
