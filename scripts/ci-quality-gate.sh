#!/usr/bin/env bash
set -euo pipefail

# Keep CI and local release checks aligned with the Node 20 Docker build image.
npm ci
npm test
npx tsc --noEmit
npm run lint
npm run build
