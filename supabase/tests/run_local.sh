#!/usr/bin/env bash
# Usage: PGHOST=/tmp/pg PGPORT=5499 PGUSER=postgres ./tests/run_local.sh
set -euo pipefail
cd "$(dirname "$0")/.."
P="psql -v ON_ERROR_STOP=1 -q"
$P -c "drop database if exists skievl_test" -c "create database skievl_test"
for f in tests/00_local_supabase_stub.sql migrations/*.sql tests/10_behaviour.sql; do
  echo "== $f"; $P -d skievl_test -f "$f"
done
echo "ALL TESTS PASSED"
