#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
ROOT="/home/ubuntu/work/BRIO"
WEB="$ROOT/code/brioweb"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
set -a
# shellcheck disable=SC1091
source "$WEB/.env.local"
set +a

request() {
  local method="$1" path="$2" jar="$3" data="${4:-}" body="$TMP/body.json"
  local args=(-sS -c "$jar" -b "$jar" -o "$body" -w '%{http_code}' -X "$method")
  if [[ -n "$data" ]]; then args+=(-H 'content-type: application/json' --data "$data"); fi
  HTTP_STATUS=$(curl "${args[@]}" "$BASE_URL$path")
  RESPONSE=$(cat "$body")
}

expect_status() {
  local expected="$1" label="$2"
  [[ "$HTTP_STATUS" == "$expected" ]] || { echo "FAIL $label expected=$expected actual=$HTTP_STATUS body=$RESPONSE"; exit 1; }
  echo "PASS $label status=$HTTP_STATUS"
}

signup() {
  local label="$1" jar="$2" suffix="$3"
  request POST /api/auth/sign-up/email "$jar" "{\"name\":\"P03 ${label}\",\"email\":\"p03-${label}-${suffix}@example.test\",\"username\":\"p03${label}${suffix}\",\"password\":\"Local-only-pass-42!\"}"
  expect_status 200 "signup_${label}"
  printf '%s' "$RESPONSE" | jq -er '.user.id'
}

now="2026-09-12T20:50:00.000Z"
day="2026-09-12"
suffix="$(date +%s)$$"
jar_a="$TMP/a.cookies"
jar_b="$TMP/b.cookies"
user_a=$(signup a "$jar_a" "$suffix" | tail -1)
user_b=$(signup b "$jar_b" "$suffix" | tail -1)

enable_for() {
  local label="$1" jar="$2"
  request GET /api/consent "$jar"
  expect_status 200 "${label}_consent_defaults"
  [[ "$(printf '%s' "$RESPONSE" | jq '[.consent.signals[].enabled] | all(. == false)')" == "true" ]] || { echo "FAIL ${label}_default_off"; exit 1; }
  request PATCH /api/consent "$jar" "{\"schemaVersion\":\"1.0.0\",\"expectedConsentVersion\":1,\"mutationId\":\"${label}-consent-${suffix}\",\"changes\":[{\"signal\":\"health_steps\",\"enabled\":true},{\"signal\":\"manual_training\",\"enabled\":true},{\"signal\":\"manual_nutrition\",\"enabled\":true},{\"signal\":\"daily_check_in\",\"enabled\":true}]}"
  expect_status 200 "${label}_consent_enable"
  [[ "$(printf '%s' "$RESPONSE" | jq -r '.consent.consentVersion')" == "2" ]] || { echo "FAIL ${label}_consent_version"; exit 1; }
}

enable_for a "$jar_a"
enable_for b "$jar_b"

request POST /api/chat "$jar_a" '{"messages":[{"role":"user","content":"Summarize today"}]}'
expect_status 403 "ai_consent_off_blocks_chat"

collision="p03-collision-${suffix}"
request POST /api/health-samples "$jar_a" "{\"externalId\":\"$collision\",\"sampleType\":\"HKQuantityTypeIdentifierStepCount\",\"value\":1111,\"unit\":\"count\",\"startDate\":\"2026-09-12T08:00:00.000Z\",\"endDate\":\"2026-09-12T09:00:00.000Z\",\"sourceName\":\"P03 device A\"}"
expect_status 201 "a_collision_insert"
[[ "$(printf '%s' "$RESPONSE" | jq -r '.acceptedCount')" == "1" ]] || exit 1
request POST /api/health-samples "$jar_b" "{\"externalId\":\"$collision\",\"sampleType\":\"HKQuantityTypeIdentifierStepCount\",\"value\":9999,\"unit\":\"count\",\"startDate\":\"2026-09-12T08:00:00.000Z\",\"endDate\":\"2026-09-12T09:00:00.000Z\",\"sourceName\":\"P03 device B\"}"
expect_status 201 "b_collision_insert"

request GET '/api/health-samples?sampleType=HKQuantityTypeIdentifierStepCount' "$jar_a"
expect_status 200 "a_owner_read"
[[ "$(printf '%s' "$RESPONSE" | jq --arg id "$collision" -r '.samples[] | select(.externalId==$id) | .value')" == "1111" ]] || { echo 'FAIL account A value changed'; exit 1; }
request GET '/api/health-samples?sampleType=HKQuantityTypeIdentifierStepCount' "$jar_b"
expect_status 200 "b_owner_read"
[[ "$(printf '%s' "$RESPONSE" | jq --arg id "$collision" -r '.samples[] | select(.externalId==$id) | .value')" == "9999" ]] || { echo 'FAIL account B value missing'; exit 1; }

request POST /api/health-samples "$jar_a" "{\"externalId\":\"$collision\",\"sampleType\":\"HKQuantityTypeIdentifierStepCount\",\"value\":2222,\"unit\":\"count\",\"startDate\":\"2026-09-12T08:00:00.000Z\",\"endDate\":\"2026-09-12T09:00:00.000Z\",\"sourceName\":\"P03 device A\"}"
expect_status 201 "same_owner_upsert"
rows=$(psql "$DATABASE_URL" -Atc "select count(*) from health_samples where external_id = '$collision';")
[[ "$rows" == "2" ]] || { echo "FAIL owner-scoped row count=$rows"; exit 1; }
echo "PASS owner_scoped_external_id rows=$rows"

null_payload='{ "sampleType":"HKQuantityTypeIdentifierStepCount","value":1,"unit":"count","startDate":"2026-09-12T10:00:00.000Z","endDate":"2026-09-12T10:01:00.000Z","sourceName":"Manual test" }'
request POST /api/health-samples "$jar_a" "$null_payload"; expect_status 201 "null_id_insert_1"
request POST /api/health-samples "$jar_a" "$null_payload"; expect_status 201 "null_id_insert_2"
null_rows=$(psql "$DATABASE_URL" -Atc "select count(*) from health_samples where user_id = '$user_a' and external_id is null and source_name = 'Manual test';")
[[ "$null_rows" == "2" ]] || { echo "FAIL null append count=$null_rows"; exit 1; }
echo "PASS null_external_ids_append rows=$null_rows"

request POST /api/health-samples "$jar_a" '{"sampleType":"HKQuantityTypeIdentifierStepCount","value":1,"unit":"count","startDate":"2026-09-12T11:00:00.000Z","endDate":"2026-09-12T10:00:00.000Z"}'
expect_status 400 "reversed_health_dates"
request POST /api/health-samples "$jar_a" '{"sampleType":"HKQuantityTypeIdentifierHeartRate","value":70,"unit":"count/min","startDate":"2026-09-12T10:00:00.000Z","endDate":"2026-09-12T10:01:00.000Z"}'
expect_status 201 "disabled_signal_request"
[[ "$(printf '%s' "$RESPONSE" | jq -r '.acceptedCount,.skippedCount' | paste -sd: -)" == "0:1" ]] || { echo "FAIL disabled signal was accepted"; exit 1; }

manual_one="{\"schemaVersion\":\"1.0.0\",\"localDate\":\"$day\",\"nutrition\":{\"energyIntakeKcal\":2100,\"proteinGrams\":160},\"mutationId\":\"manual-one-${suffix}\",\"revision\":0,\"recordedAt\":\"$now\"}"
request POST /api/manual-logs "$jar_a" "$manual_one"; expect_status 200 "manual_create"
request POST /api/manual-logs "$jar_a" "$manual_one"; expect_status 200 "manual_duplicate_idempotent"
manual_two="{\"schemaVersion\":\"1.0.0\",\"localDate\":\"$day\",\"nutrition\":{\"energyIntakeKcal\":2200,\"proteinGrams\":165},\"mutationId\":\"manual-two-${suffix}\",\"revision\":0,\"recordedAt\":\"$now\"}"
request POST /api/manual-logs "$jar_a" "$manual_two"; expect_status 200 "manual_revision_update"
[[ "$(printf '%s' "$RESPONSE" | jq -r '.manualLog.revision')" == "1" ]] || { echo 'FAIL manual revision'; exit 1; }
manual_stale="{\"schemaVersion\":\"1.0.0\",\"localDate\":\"$day\",\"nutrition\":{\"energyIntakeKcal\":2300},\"mutationId\":\"manual-stale-${suffix}\",\"revision\":0,\"recordedAt\":\"$now\"}"
request POST /api/manual-logs "$jar_a" "$manual_stale"; expect_status 409 "manual_stale_revision"

checkin="{\"schemaVersion\":\"1.0.0\",\"localDate\":\"$day\",\"responses\":[{\"key\":\"fatigue\",\"rating\":3},{\"key\":\"muscle_soreness\",\"rating\":2},{\"key\":\"sleep_quality\",\"rating\":4},{\"key\":\"stress\",\"rating\":2},{\"key\":\"mood\",\"rating\":4}],\"mutationId\":\"checkin-${suffix}\",\"revision\":0,\"recordedAt\":\"$now\"}"
request POST /api/check-ins "$jar_a" "$checkin"; expect_status 200 "checkin_create"
request POST /api/check-ins "$jar_a" "$checkin"; expect_status 200 "checkin_duplicate_idempotent"

session_id="session-${suffix}"
session_draft="{\"schemaVersion\":\"1.0.0\",\"id\":\"$session_id\",\"title\":\"Lower strength\",\"status\":\"draft\",\"inputDataMode\":\"manual\",\"startedAt\":null,\"endedAt\":null,\"exercises\":[{\"id\":\"ex-1\",\"order\":0,\"name\":\"Back squat\",\"notes\":\"\",\"sets\":[{\"id\":\"set-1\",\"order\":0,\"type\":\"working\",\"loadKg\":100,\"reps\":5,\"rpe\":7,\"completed\":false,\"completedAt\":null,\"restStartedAt\":null,\"restDurationSeconds\":120}]}],\"notes\":\"\",\"revision\":0,\"mutationId\":\"session-draft-${suffix}\"}"
request POST /api/training/sessions "$jar_a" "$session_draft"; expect_status 201 "session_create"
request POST /api/training/sessions "$jar_a" "$session_draft"; expect_status 201 "session_duplicate_idempotent"
session_complete="{\"schemaVersion\":\"1.0.0\",\"id\":\"$session_id\",\"title\":\"Lower strength\",\"status\":\"completed\",\"inputDataMode\":\"manual\",\"startedAt\":\"2026-09-12T19:00:00.000Z\",\"endedAt\":\"2026-09-12T20:00:00.000Z\",\"exercises\":[{\"id\":\"ex-1\",\"order\":0,\"name\":\"Back squat\",\"notes\":\"\",\"sets\":[{\"id\":\"set-1\",\"order\":0,\"type\":\"working\",\"loadKg\":100,\"reps\":5,\"rpe\":7,\"completed\":true,\"completedAt\":\"2026-09-12T19:10:00.000Z\",\"restStartedAt\":\"2026-09-12T19:10:00.000Z\",\"restDurationSeconds\":120}]}],\"notes\":\"\",\"revision\":0,\"mutationId\":\"session-complete-${suffix}\"}"
request PATCH "/api/training/sessions/$session_id" "$jar_a" "$session_complete"; expect_status 200 "session_complete"
request PATCH "/api/training/sessions/$session_id" "$jar_a" "$session_complete"; expect_status 200 "session_complete_idempotent"
workout_rows=$(psql "$DATABASE_URL" -Atc "select count(*) from workouts where user_id = '$user_a' and external_id = 'brio-session:$session_id';")
[[ "$workout_rows" == "1" ]] || { echo "FAIL workout projection count=$workout_rows"; exit 1; }
echo "PASS session_projection_once rows=$workout_rows"

payload=$(jq -nc --arg id "decision-${suffix}" --arg generated "$now" '{schemaVersion:"1.0.0",policyVersion:"prototype-1",id:$id,status:"proposed",action:"Maintain",proposal:{target:"session_load",direction:"hold",amount:null,unit:"none",lowerBound:null,upperBound:null,editable:true,text:"Keep the planned load unchanged."},inputDataMode:"manual",executionMode:"deterministic_prototype",evidence:[],excludedSignals:[],uncertainty:["Only manual evidence is available."],specialists:[],disagreement:{present:false,summary:null},policyReason:"Prototype policy found no supported reason to change the session.",consentVersion:2,generatedAt:$generated,staleAt:null}')
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 --set=user_id="$user_a" --set=decision_id="decision-${suffix}" --set=payload="$payload" <<'SQL' >/dev/null
INSERT INTO decisions (id,user_id,status,action,input_data_mode,execution_mode,payload,consent_version,generated_at)
VALUES (:'decision_id', :'user_id', 'proposed', 'Maintain', 'manual', 'deterministic_prototype', :'payload'::jsonb, 2, '2026-09-12T20:50:00.000Z');
SQL
request PATCH /api/consent "$jar_a" "{\"schemaVersion\":\"1.0.0\",\"expectedConsentVersion\":2,\"mutationId\":\"consent-revoke-${suffix}\",\"changes\":[{\"signal\":\"health_steps\",\"enabled\":false}]}"
expect_status 200 "consent_increment_and_revoke"
request GET /api/decisions "$jar_a"; expect_status 200 "decision_history_after_revoke"
[[ "$(printf '%s' "$RESPONSE" | jq -r --arg id "decision-${suffix}" '.history[] | select(.id==$id) | .status')" == "stale" ]] || { echo 'FAIL decision not stale'; exit 1; }
echo 'PASS consent_change_stales_decision'

request GET /api/export "$jar_a"; expect_status 200 "export_current_user"
[[ "$(printf '%s' "$RESPONSE" | jq -r '.accountId')" == "$user_a" ]] || { echo 'FAIL export owner'; exit 1; }
[[ "$(printf '%s' "$RESPONSE" | jq 'has("sessions") or has("password") or has("accounts")')" == "false" ]] || { echo 'FAIL export contains auth secrets'; exit 1; }
echo 'PASS export_excludes_auth_credentials'

echo 'P03 integration suite complete'
