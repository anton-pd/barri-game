#!/usr/bin/env bash
set -euo pipefail

umask 077

backup_root="${BARRI_BACKUP_ROOT:-/opt/apps/backups/barri}"
postgres_container="${BARRI_POSTGRES_CONTAINER:-apps-postgres-1}"
postgres_user="${BARRI_POSTGRES_USER:-anton}"
shared_data_dir="${BARRI_SHARED_DATA_DIR:-/opt/apps/shared_data}"
retention_days="${BARRI_BACKUP_RETENTION_DAYS:-14}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
restore_database="barri_restore_check_${timestamp,,}_$$"
restore_database="${restore_database//[^a-z0-9_]/_}"
partial_files=()

if [[ ! "${retention_days}" =~ ^[0-9]+$ ]] || (( retention_days < 1 )); then
  echo "[backup] BARRI_BACKUP_RETENTION_DAYS must be a positive integer" >&2
  exit 64
fi

install -d -m 700 "${backup_root}"
exec 9>"${backup_root}/.backup.lock"
if ! flock -n 9; then
  echo "[backup] another backup is already running" >&2
  exit 75
fi

cleanup() {
  docker exec "${postgres_container}" \
    dropdb -U "${postgres_user}" --if-exists "${restore_database}" >/dev/null 2>&1 || true
  for partial in "${partial_files[@]}"; do
    [[ -f "${partial}" ]] && rm -f -- "${partial}"
  done
}
trap cleanup EXIT

echo "[backup] starting ${timestamp}"
for database in barri_prod barri_dev; do
  partial="${backup_root}/.${database}-${timestamp}.dump.partial"
  final="${backup_root}/${database}-${timestamp}.dump"
  partial_files+=("${partial}")

  docker exec "${postgres_container}" \
    pg_dump -U "${postgres_user}" -d "${database}" \
      --format=custom --compress=6 --no-owner --no-privileges > "${partial}"
  [[ -s "${partial}" ]]
  docker exec -i "${postgres_container}" pg_restore --list < "${partial}" >/dev/null

  mv -- "${partial}" "${final}"
  chmod 600 "${final}"
  (
    cd "${backup_root}"
    sha256sum "$(basename "${final}")" > "$(basename "${final}").sha256"
  )
  chmod 600 "${final}.sha256"
  echo "[backup] wrote ${final}"
done

scenario_partial="${backup_root}/.scenarios-${timestamp}.tar.gz.partial"
scenario_final="${backup_root}/scenarios-${timestamp}.tar.gz"
partial_files+=("${scenario_partial}")
tar -C "${shared_data_dir}" -czf "${scenario_partial}" scenarios
[[ -s "${scenario_partial}" ]]
tar -tzf "${scenario_partial}" >/dev/null
mv -- "${scenario_partial}" "${scenario_final}"
chmod 600 "${scenario_final}"
(
  cd "${backup_root}"
  sha256sum "$(basename "${scenario_final}")" > "$(basename "${scenario_final}").sha256"
)
chmod 600 "${scenario_final}.sha256"
echo "[backup] wrote ${scenario_final}"

prod_dump="${backup_root}/barri_prod-${timestamp}.dump"
docker exec "${postgres_container}" \
  createdb -U "${postgres_user}" -T template0 "${restore_database}"
docker exec -i "${postgres_container}" \
  pg_restore -U "${postgres_user}" -d "${restore_database}" \
    --exit-on-error --single-transaction --no-owner --no-privileges < "${prod_dump}"

production_counts="$(
  docker exec "${postgres_container}" \
    psql -U "${postgres_user}" -d barri_prod -At -F ':' \
      -c 'SELECT (SELECT count(*) FROM users), (SELECT count(*) FROM game_sessions), (SELECT count(*) FROM messages);'
)"
restored_counts="$(
  docker exec "${postgres_container}" \
    psql -U "${postgres_user}" -d "${restore_database}" -At -F ':' \
      -c 'SELECT (SELECT count(*) FROM users), (SELECT count(*) FROM game_sessions), (SELECT count(*) FROM messages);'
)"

if [[ "${production_counts}" != "${restored_counts}" ]]; then
  echo "[backup] restore verification failed: critical table counts differ" >&2
  exit 1
fi
echo "[backup] restore verified (users:sessions:messages=${restored_counts})"

docker exec "${postgres_container}" \
  dropdb -U "${postgres_user}" "${restore_database}"

find "${backup_root}" -maxdepth 1 -type f \
  \( -name 'barri_prod-*.dump' \
    -o -name 'barri_dev-*.dump' \
    -o -name 'scenarios-*.tar.gz' \
    -o -name 'barri_prod-*.dump.sha256' \
    -o -name 'barri_dev-*.dump.sha256' \
    -o -name 'scenarios-*.tar.gz.sha256' \) \
  -mtime "+${retention_days}" -delete

echo "[backup] complete ${timestamp}"
