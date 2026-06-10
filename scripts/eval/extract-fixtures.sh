#!/usr/bin/env bash
# ANT-140: extract session fixtures for the model eval from the barri_dev DB.
# Fixtures are gitignored (they contain full session transcripts) — regenerate
# them with this script before running run-eval.ts.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p fixtures

SESSIONS=(
  ef137c56-d976-41d1-ae55-db2fbb7e0394  # the-haunting, fresh QA session (short history)
  1ec276ae-ea03-4002-b9b2-be60f2d0cde3  # the-last-telegram, 103 msgs (deep history)
)

for sid in "${SESSIONS[@]}"; do
  p="${sid:0:8}"
  docker exec apps-postgres-1 psql -U anton barri_dev -t -A -c \
    "SELECT row_to_json(t) FROM (SELECT id, scenario_id, language, keeper_style, world_state, players FROM game_sessions WHERE id='$sid') t;" \
    > "fixtures/session_${p}.json"
  docker exec apps-postgres-1 psql -U anton barri_dev -t -A -c \
    "SELECT json_agg(t) FROM (SELECT id, role, content, player_idx FROM messages WHERE session_id='$sid' ORDER BY id) t;" \
    > "fixtures/messages_${p}.json"
  echo "extracted $p"
done
