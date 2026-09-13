#!/usr/bin/env bash
set -euo pipefail
BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
ROOT="/home/ubuntu/work/BRIO"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
request(){ local method="$1" path="$2" jar="$3" data="${4:-}" body="$TMP/body"; local args=(-sS -c "$jar" -b "$jar" -o "$body" -w '%{http_code}' -X "$method"); [[ -n "$data" ]] && args+=(-H 'content-type: application/json' --data "$data"); HTTP_STATUS=$(curl "${args[@]}" "$BASE_URL$path"); RESPONSE=$(cat "$body"); }
expect(){ [[ "$HTTP_STATUS" == "$1" ]] || { echo "FAIL $2 expected=$1 actual=$HTTP_STATUS body=$RESPONSE"; exit 1; }; echo "PASS $2 status=$HTTP_STATUS"; }
suffix="$(date +%s)$$"; day="2026-09-13"; now="2026-09-13T09:00:00.000Z"; jar_a="$TMP/a"; jar_b="$TMP/b"
signup(){ local who="$1" jar="$2"; request POST /api/auth/sign-up/email "$jar" "{\"name\":\"Release $who\",\"email\":\"release-$who-$suffix@example.test\",\"username\":\"release${who}${suffix}\",\"password\":\"Local-only-pass-42!\"}"; expect 200 "signup_$who"; }
signup a "$jar_a"; signup b "$jar_b"
request GET /api/preferences "$jar_a"; expect 200 preferences_default; revision=$(printf %s "$RESPONSE"|jq -r .preferences.revision)
request PATCH /api/preferences "$jar_a" "{\"schemaVersion\":\"1.0.0\",\"revision\":$revision,\"mutationId\":\"prefs-$suffix\",\"timezone\":\"Europe/Dublin\",\"goal\":\"build_strength\",\"trainingBlock\":\"build\",\"usageMode\":\"guided\",\"restrictionText\":\"\",\"restrictions\":[],\"onboardingCompleted\":true}"; expect 200 preferences_onboarding_complete
request GET /api/consent "$jar_a"; expect 200 consent_a; version=$(printf %s "$RESPONSE"|jq -r .consent.consentVersion)
request PATCH /api/consent "$jar_a" "{\"schemaVersion\":\"1.0.0\",\"expectedConsentVersion\":$version,\"mutationId\":\"consent-a-$suffix\",\"changes\":[{\"signal\":\"health_steps\",\"enabled\":true},{\"signal\":\"manual_training\",\"enabled\":true},{\"signal\":\"manual_nutrition\",\"enabled\":true},{\"signal\":\"daily_check_in\",\"enabled\":true}]}"; expect 200 consent_a_enable
request GET /api/consent "$jar_b"; expect 200 consent_b; version_b=$(printf %s "$RESPONSE"|jq -r .consent.consentVersion)
request PATCH /api/consent "$jar_b" "{\"schemaVersion\":\"1.0.0\",\"expectedConsentVersion\":$version_b,\"mutationId\":\"consent-b-$suffix\",\"changes\":[{\"signal\":\"health_steps\",\"enabled\":true}]}"; expect 200 consent_b_enable
external="release-shared-$suffix"
sample="{\"externalId\":\"$external\",\"sampleType\":\"HKQuantityTypeIdentifierStepCount\",\"value\":7000,\"unit\":\"count\",\"startDate\":\"$now\",\"endDate\":\"2026-09-13T10:00:00.000Z\",\"sourceName\":\"Release helper\"}"
request POST /api/health-samples "$jar_a" "$sample"; expect 201 health_a
sample_b=$(printf %s "$sample"|jq '.value=9000')
request POST /api/health-samples "$jar_b" "$sample_b"; expect 201 health_b
request POST /api/health-samples/deletions "$jar_a" "{\"externalIds\":[\"$external\"]}"; expect 200 owner_deletion_reconcile
[[ $(printf %s "$RESPONSE"|jq -r .deletedCount) == 1 ]] || { echo FAIL owner_deletion_count; exit 1; }
request GET '/api/health-samples?sampleType=HKQuantityTypeIdentifierStepCount' "$jar_b"; expect 200 other_owner_after_delete
[[ $(printf %s "$RESPONSE"|jq -r --arg id "$external" '.samples[]|select(.externalId==$id)|.value') == 9000 ]] || { echo FAIL deletion_crossed_owner; exit 1; }
echo PASS deletion_is_owner_scoped
request POST /api/manual-logs "$jar_a" "{\"schemaVersion\":\"1.0.0\",\"localDate\":\"$day\",\"nutrition\":{\"energyIntakeKcal\":2400,\"proteinGrams\":160,\"carbohydrateGrams\":260},\"mutationId\":\"manual-$suffix\",\"revision\":0,\"recordedAt\":\"$now\"}"; expect 200 manual_log
request POST /api/check-ins "$jar_a" "{\"schemaVersion\":\"1.0.0\",\"localDate\":\"$day\",\"responses\":[{\"key\":\"fatigue\",\"rating\":3},{\"key\":\"muscle_soreness\",\"rating\":2},{\"key\":\"sleep_quality\",\"rating\":4},{\"key\":\"stress\",\"rating\":2},{\"key\":\"mood\",\"rating\":4}],\"mutationId\":\"check-$suffix\",\"revision\":0,\"recordedAt\":\"$now\"}"; expect 200 checkin
request GET "/api/dashboard?date=$day" "$jar_a"; expect 200 dashboard
[[ $(printf %s "$RESPONSE"|jq '.dashboard.metrics|length') == 9 ]] || { echo FAIL dashboard_metric_count; exit 1; }
[[ $(printf %s "$RESPONSE"|jq -r '.dashboard.metrics[]|select(.key=="protein")|.value') == 160 ]] || { echo FAIL dashboard_protein; exit 1; }
echo PASS dashboard_nine_metrics_and_manual_projection
request POST /api/decisions "$jar_a" "{\"localDate\":\"$day\"}"; expect 201 deterministic_decision
decision_id=$(printf %s "$RESPONSE"|jq -r .decision.id); action=$(printf %s "$RESPONSE"|jq -r .decision.action); cv=$(printf %s "$RESPONSE"|jq -r .decision.consentVersion); proposal=$(printf %s "$RESPONSE"|jq -c .decision.proposal)
request POST "/api/decisions/$decision_id/respond" "$jar_a" "{\"schemaVersion\":\"1.0.0\",\"decisionId\":\"$decision_id\",\"kind\":\"accepted\",\"selectedAction\":\"$action\",\"proposal\":$proposal,\"reason\":null,\"mutationId\":\"response-$suffix\",\"consentVersion\":$cv,\"respondedAt\":\"$now\"}"; expect 200 decision_response
request POST /api/decisions/live "$jar_a" "{\"localDate\":\"$day\"}"; expect 403 live_agent_consent_off_no_model_call
request GET /api/export "$jar_a"; expect 200 export
[[ $(printf %s "$RESPONSE"|jq '.decisions|length') -ge 1 ]] || { echo FAIL export_decisions; exit 1; }
for path in /manifest.webmanifest /sw.js /offline /demo; do request GET "$path" "$TMP/public"; expect 200 "public_${path//\//_}"; done
echo 'RELEASE INTEGRATION COMPLETE'
