#!/usr/bin/env bash
set -euo pipefail
BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
ROOT=/home/ubuntu/work/BRIO
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
JAR="$TMP/demo-cookie"
EMAIL='brio-ecp-demo@example.test'
PASSWORD='Local-only-ECP-demo-42!'

request(){
  local method="$1" path="$2" data="${3:-}" body="$TMP/body"
  local args=(-sS -c "$JAR" -b "$JAR" -o "$body" -w '%{http_code}' -X "$method")
  [[ -n "$data" ]] && args+=(-H 'content-type: application/json' --data "$data")
  HTTP_STATUS=$(curl "${args[@]}" "$BASE_URL$path")
  RESPONSE=$(cat "$body")
}
expect(){ [[ "$HTTP_STATUS" == "$1" ]] || { echo "FAIL $2 expected=$1 actual=$HTTP_STATUS body=$RESPONSE"; exit 1; }; echo "PASS $2 status=$HTTP_STATUS"; }

request POST /api/auth/sign-up/email '{"name":"BRIO ECP Demo","email":"brio-ecp-demo@example.test","username":"brioecpdemo","password":"Local-only-ECP-demo-42!"}'
expect 200 signup
USER_ID=$(printf %s "$RESPONSE" | jq -r .user.id)
TODAY=$(date -u +%F)
profiles=(young_male_athlete returning_professional endurance_builder strength_parent active_older_returner)
actions=(Progress Maintain Repeat Reduce Escalate)

for index in "${!profiles[@]}"; do
  profile=${profiles[$index]}; action=${actions[$index]}
  request POST /api/demo/reset "$(jq -nc --arg date "$TODAY" --arg id "$profile" '{anchorDate:$date,ecpId:$id}')"
  expect 200 "reset_$profile"
  [[ $(printf %s "$RESPONSE" | jq -r .fixture.ecp.defaultAction) == "$action" ]] || { echo "FAIL action_$profile"; exit 1; }
  [[ $(printf %s "$RESPONSE" | jq -r .fixture.counts.namedFoods) == 56 ]] || { echo "FAIL food_count_$profile"; exit 1; }
  request GET /api/export
  expect 200 "export_$profile"
  [[ $(printf %s "$RESPONSE" | jq '.healthSamples|length') == 84 ]] || { echo "FAIL health_count_$profile"; exit 1; }
  [[ $(printf %s "$RESPONSE" | jq '.manualLogs|length') == 14 ]] || { echo "FAIL nutrition_days_$profile"; exit 1; }
  [[ $(printf %s "$RESPONSE" | jq '.checkIns|length') == 14 ]] || { echo "FAIL checkin_days_$profile"; exit 1; }
  [[ $(printf %s "$RESPONSE" | jq '.trainingSessions|length') == 4 ]] || { echo "FAIL sessions_$profile"; exit 1; }
  [[ $(printf %s "$RESPONSE" | jq '[.manualLogs[].payload.nutrition.foods[] | select(.name | startswith("[SYNTHETIC DEMO FOOD]"))] | length') == 56 ]] || { echo "FAIL food_labels_$profile"; exit 1; }
  [[ $(printf %s "$RESPONSE" | jq '[.healthSamples[] | select(.metadata.synthetic == true and (.sourceName | contains("not Apple Health")))] | length') == 84 ]] || { echo "FAIL health_labels_$profile"; exit 1; }
  [[ $(printf %s "$RESPONSE" | jq '[.consent.signals[] | select(.enabled == true)] | length') == 8 ]] || { echo "FAIL consent_$profile"; exit 1; }
  echo "PASS $profile complete_14_day_history action=$action"
done

request POST /api/demo/reset "$(jq -nc --arg date "$TODAY" '{anchorDate:$date,ecpId:"young_male_athlete"}')"
expect 200 repeat_reset_young
request GET /api/export
expect 200 repeat_export_young
[[ $(printf %s "$RESPONSE" | jq '.healthSamples|length') == 84 ]] || { echo FAIL repeat_health; exit 1; }
[[ $(printf %s "$RESPONSE" | jq '.manualLogs|length') == 14 ]] || { echo FAIL repeat_manual; exit 1; }

set -a; source "$ROOT/code/brioweb/.env.local"; set +a
WORKOUT_COUNT=$(psql "$DATABASE_URL" -Atc "select count(*) from workouts where user_id='$USER_ID'")
[[ "$WORKOUT_COUNT" == 9 ]] || { echo "FAIL workout_projection_count=$WORKOUT_COUNT"; exit 1; }
SYNTHETIC_WORKOUT_COUNT=$(psql "$DATABASE_URL" -Atc "select count(*) from workouts where user_id='$USER_ID' and (source_name='BRIO synthetic ECP generator' or source_name='BRIO synthetic test generator')")
[[ "$SYNTHETIC_WORKOUT_COUNT" == 9 ]] || { echo "FAIL workout_provenance_count=$SYNTHETIC_WORKOUT_COUNT"; exit 1; }
echo "PASS repeat_reset_idempotent workouts=$WORKOUT_COUNT"
echo "ECP LIVE AGENT DATA INTEGRATION COMPLETE"
