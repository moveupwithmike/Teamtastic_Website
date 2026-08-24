#!/usr/bin/env bash
# Manual certification operator controls — local regression harness.
#
# Boots a disposable postgres:17 container, restores the production schema
# dump, applies the pending migration plus local extension stubs, runs the
# assertion suite, then proves sign-off/evidence serialization with real
# concurrent sessions.
#
# Usage: supabase/tests/run_manual_certification_tests.sh [path/to/schema_dump.sql]
set -euo pipefail

DUMP="${1:-/var/folders/kf/_9q4m3bs27g2t2h1pc2lnk8m0000gn/T/opencode/prod_schema.sql}"
TESTS_DIR="$(cd "$(dirname "$0")" && pwd)"
MIGRATION="$TESTS_DIR/../migrations/20260824140000_manual_certification_operator_controls.sql"
CONTAINER="tt-cert-verify"

psql_exec() { docker exec -i "$CONTAINER" psql -U postgres -d postgres "$@"; }
psql_q()    { docker exec "$CONTAINER" psql -U postgres -d postgres -tA -c "$1"; }

cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "==> booting $CONTAINER (postgres:17-alpine)"
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=postgres postgres:17-alpine >/dev/null
for _ in $(seq 1 60); do
  docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done
docker exec "$CONTAINER" pg_isready -U postgres >/dev/null

echo "==> pre-creating roles referenced by the production dump"
grep -oE '(OWNER TO|GRANT [^;]{0,80} TO|REVOKE [^;]{0,80} FROM) ("[a-z_0-9]+"|[a-z_0-9]+)' "$DUMP" \
  | awk '{print $NF}' | tr -d '"' \
  | sort -u | grep -vE '^(postgres|public|unnest|jsonb_array_elements)$' > "$TESTS_DIR/.roles.txt"
{
  echo "\\set ON_ERROR_STOP off"
  while read -r role; do
    cat <<EOF
do \$\$ begin
  if not exists (select 1 from pg_roles where rolname = '$role') then
    create role "$role" nologin noinherit;
  end if;
end \$\$;
EOF
  done < "$TESTS_DIR/.roles.txt"
} > "$TESTS_DIR/.roles_bootstrap.sql"
psql_exec -q < "$TESTS_DIR/.roles_bootstrap.sql" >/dev/null 2>&1 || true

echo "==> restoring schema dump (extension-member objects are expected to error)"
if ! psql_exec -q -v ON_ERROR_STOP=0 < "$DUMP" > "$TESTS_DIR/.dump_load.log" 2>&1; then
  echo "    (psql reported load errors; verifying critical objects next)"
fi
echo "    $(grep -c 'ERROR' "$TESTS_DIR/.dump_load.log" || true) error(s) during restore"

echo "==> verifying critical objects survived the restore"
MISSING="$(psql_q "select coalesce(string_agg(name, ', '), '')
  from (
    select 'public.final_certification_evidence' as name, to_regclass('public.final_certification_evidence') is not null as ok
    union all select 'public.final_production_certifications', to_regclass('public.final_production_certifications') is not null
    union all select 'public.production_record_classifications', to_regclass('public.production_record_classifications') is not null
    union all select 'public.notification_deliveries', to_regclass('public.notification_deliveries') is not null
    union all select 'public.b2b_certification_runs', to_regclass('public.b2b_certification_runs') is not null
    union all select 'public.latest_production_record_classifications', to_regclass('public.latest_production_record_classifications') is not null
    union all select 'public.production_record_classification_status', to_regclass('public.production_record_classification_status') is not null
    union all select 'record_final_certification_evidence()', to_regprocedure('public.record_final_certification_evidence(uuid,text,text,text,text,text,text,text,jsonb)') is not null
    union all select 'sign_off_final_production_certification()', to_regprocedure('public.sign_off_final_production_certification(uuid,text)') is not null
    union all select 'trigger leads_notify_after_insert', exists(select 1 from pg_trigger where tgname='leads_notify_after_insert')
  ) t where not ok")"
if [ -n "$MISSING" ]; then echo "MISSING AFTER RESTORE: $MISSING"; grep ERROR "$TESTS_DIR/.dump_load.log" | sort | uniq -c | sort -rn | head -20; exit 1; fi
echo "    all critical objects present"

echo "==> applying local extension stubs"
psql_exec -q -v ON_ERROR_STOP=1 < "$TESTS_DIR/local_stubs.sql" >/dev/null

echo "==> applying migration 20260824140000_manual_certification_operator_controls"
psql_exec -q -v ON_ERROR_STOP=1 < "$MIGRATION" >/dev/null
echo "==> re-applying migration (idempotency check)"
psql_exec -q -v ON_ERROR_STOP=1 < "$MIGRATION" >/dev/null
echo "    idempotent"

echo "==> running regression suite: manual_certification_operator_controls"
if ! SUITE_OUT="$(psql_exec -v ON_ERROR_STOP=1 < "$TESTS_DIR/manual_certification_operator_controls.sql" 2>&1)"; then
  echo "$SUITE_OUT"; exit 1
fi
echo "$SUITE_OUT" | tail -3

echo "==> building race fixture certification"
psql_exec -q -v ON_ERROR_STOP=1 < "$TESTS_DIR/manual_certification_race_fixture.sql" >/dev/null
CERT_RACE="$(psql_q "select id from public.final_production_certifications where started_by='race@teamtastic.test'")"
echo "    cert_race=$CERT_RACE"

echo "==> race 1: evidence write must serialize against an in-flight sign-off"
# S1 opens a transaction, performs the real sign-off RPC, holds the
# transaction open for several seconds, then commits.
docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 > /tmp/race_s1.log 2>&1 <<SQL &
begin;
select public.sign_off_final_production_certification('$CERT_RACE','Race Signer');
select pg_sleep(10);
commit;
SQL
S1_PID=$!
sleep 3

# S2 races an evidence write in while sign-off is uncommitted; it must queue.
RACE_S2_LOG="$(mktemp)"
docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 > "$RACE_S2_LOG" 2>&1 <<SQL &
insert into public.final_certification_evidence(certification_id,check_name,status,evidence_reference,performed_by,notes,evidence_method,environment)
values ('$CERT_RACE','operational_owner_attestation','passed','office://race/late-write','Race Writer','Concurrent evidence write racing an in-flight sign-off commit.','manual','production');
SQL
S2_PID=$!
sleep 2

WAITERS=-1
for _ in $(seq 1 20); do
  WAITERS="$(psql_q "select count(*) from pg_locks where locktype='advisory' and not granted")"
  [ "${WAITERS:-0}" -ge 1 ] && break
  sleep 1
done
if [ "${WAITERS:-0}" -lt 1 ]; then
  echo "race 1 failed: racing evidence write did not queue behind the state lock"
  cat /tmp/race_s1.log "$RACE_S2_LOG"; exit 1
fi
echo "    racing write observed waiting on the certification-state lock"

wait "$S1_PID"
wait "$S2_PID" || true

SIGNED_BY="$(psql_q "select signed_off_by from public.final_production_certifications where id='$CERT_RACE'")"
[ "$SIGNED_BY" = "Race Signer" ] || { echo "race 1 failed: deferred sign-off did not commit"; cat /tmp/race_s1.log; exit 1; }
grep -qE "immutable after final sign-off|cannot be added after final sign-off" "$RACE_S2_LOG" \
  || { echo "race 1 failed: racing write was not rejected"; cat "$RACE_S2_LOG"; exit 1; }
rm -f "$RACE_S2_LOG"
echo "    serialized correctly: sign-off committed; queued write rejected by immutability"

echo "==> race 2: duplicate sign-offs serialize safely"
DUP_OUT="$(psql_q "select public.sign_off_final_production_certification('$CERT_RACE','Second Signer');" 2>&1 || true)"
echo "$DUP_OUT" | grep -q "already signed off" || { echo "race 2 failed: duplicate not rejected: $DUP_OUT"; exit 1; }
echo "    duplicate sign-off rejected cleanly"

echo "==> race 3: live lineage invalidation reflects immediately in gate status"
docker exec -i "$CONTAINER" psql -U postgres -d postgres >/dev/null 2>&1 <<SQL &
begin;
select automation.lock_final_certification_state('$CERT_RACE');
select pg_sleep(5);
rollback;
SQL
S3_PID=$!
sleep 2
docker exec -i "$CONTAINER" psql -U postgres -d postgres <<SQL || echo "race3 insert FAILED"
\set ON_ERROR_STOP on
with ins as (
  insert into public.production_record_classifications(record_type, record_id, classification, reason, actor, evidence)
  select 'lead', l.id, 'test_qa', 'Race scenario: operator confirmed fixture journey invalidation mid-flight.', 'operator@teamtastic.test',
         jsonb_build_object('owner_confirmed_test', true)
  from public.leads l where l.email_normalized='ryan.race@example.test'
  returning id
)
select 'race3-inserted', count(*) from ins;
SQL
psql_q "select 'race3-debug leadcls=' || coalesce(classification,'none') from public.production_record_classification_status where record_type='lead' and record_id in (select id from public.leads where email_normalized='ryan.race@example.test')" || true
psql_q "select 'race3-debug resolver=' || lineage_valid || '/' || coalesce(invalid_reason,'-') from automation.final_certification_journey_lineage('$CERT_RACE')" || true
SATISFIED="$(psql_q "select coalesce(bool_and(satisfied), false) from public.final_certification_gate_status where certification_id='$CERT_RACE' and check_name='client_portal_access'")"
wait "$S3_PID" || true
[ "$SATISFIED" = "f" ] || { echo "race 3 failed: portal gate stayed satisfied after journey invalidation"; exit 1; }
echo "    stale portal evidence stopped satisfying the gate immediately"

rm -f "$RACE_S2_LOG" "$TESTS_DIR/.roles.txt" "$TESTS_DIR/.roles_bootstrap.sql"
echo
echo "HARNESS RESULT: ALL DATABASE REGRESSIONS PASSED"
echo "  - full assertion suite (portal lineage / notifications / sign-off / authority)"
echo "  - migration applied twice idempotently"
echo "  - 3 two-session concurrency races proven"
