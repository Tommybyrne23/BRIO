#!/usr/bin/env bash
set -euo pipefail
BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
suffix="$(date +%s)$$"
jar="$TMP/session.cookies"
status=$(curl -sS -c "$jar" -b "$jar" -o "$TMP/signup.json" -w '%{http_code}' -H 'content-type: application/json' -X POST "$BASE_URL/api/auth/sign-up/email" --data "{\"name\":\"Delete Test\",\"email\":\"delete-${suffix}@example.test\",\"username\":\"delete${suffix}\",\"password\":\"Local-only-pass-42!\"}")
[[ "$status" == "200" ]] || { echo "FAIL signup $status"; exit 1; }
user_id=$(jq -er '.user.id' "$TMP/signup.json")
status=$(curl -sS -c "$jar" -b "$jar" -o "$TMP/delete.json" -w '%{http_code}' -H 'content-type: application/json' -X DELETE "$BASE_URL/api/account" --data '{"confirmation":"DELETE"}')
[[ "$status" == "200" && "$(jq -r '.deleted' "$TMP/delete.json")" == "true" ]] || { echo "FAIL delete $status $(cat "$TMP/delete.json")"; exit 1; }
status=$(curl -sS -c "$jar" -b "$jar" -o "$TMP/after.json" -w '%{http_code}' "$BASE_URL/api/preferences")
[[ "$status" == "401" ]] || { echo "FAIL deleted session remained active: $status"; exit 1; }
set -a
# shellcheck disable=SC1091
source /home/ubuntu/work/BRIO/code/brioweb/.env.local
set +a
rows=$(psql "$DATABASE_URL" -Atc "select count(*) from \"user\" where id = '$user_id';")
[[ "$rows" == "0" ]] || { echo "FAIL deleted user row remains"; exit 1; }
echo 'PASS account deletion removed the user and invalidated the session'
