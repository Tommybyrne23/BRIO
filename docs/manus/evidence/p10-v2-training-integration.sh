#!/usr/bin/env bash
set -euo pipefail
BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
ROOT="/home/ubuntu/work/BRIO"; TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
request(){ local method="$1" path="$2" jar="$3" data="${4:-}" body="$TMP/body"; local args=(-sS -c "$jar" -b "$jar" -o "$body" -w '%{http_code}' -X "$method"); [[ -n "$data" ]] && args+=(-H 'content-type: application/json' --data "$data"); HTTP_STATUS=$(curl "${args[@]}" "$BASE_URL$path"); RESPONSE=$(cat "$body"); }
expect(){ [[ "$HTTP_STATUS" == "$1" ]] || { echo "FAIL $2 expected=$1 actual=$HTTP_STATUS body=$RESPONSE"; exit 1; }; echo "PASS $2 status=$HTTP_STATUS"; }
suffix="$(date +%s)$$"; today="$(date -u +%F)"; prior_day="$(date -u -d '7 days ago' +%F)"; jar="$TMP/user"; fake_jar="$TMP/fake"
email="training-$suffix@example.test"; fake_email="synthetic-$suffix@example.test"; password='Local-only-pass-42!'
signup(){ local target="$1" who="$2"; request POST /api/auth/sign-up/email "$target" "{\"name\":\"P10 $who\",\"email\":\"$who\",\"username\":\"p10${suffix}${RANDOM}\",\"password\":\"$password\"}"; expect 200 "signup_$who"; }
signup "$jar" "$email"; user_id=$(printf %s "$RESPONSE"|jq -r .user.id)
request GET /api/preferences "$jar"; expect 200 profile_defaults; revision=$(printf %s "$RESPONSE"|jq -r .preferences.revision)
profile='{"birthYear":1991,"sex":"prefer_not_to_say","activityLevel":"high","trainingExperience":"three_to_five_years","primaryTraining":"strength","trainingDaysPerWeek":4,"typicalSessionMinutes":60,"recentTrainingSummary":"Four weekly strength sessions over the previous eight weeks.","equipmentAccess":"Barbell, rack and dumbbells","completed":true}'
request PATCH /api/preferences "$jar" "{\"schemaVersion\":\"1.0.0\",\"revision\":$revision,\"mutationId\":\"profile-$suffix\",\"profile\":$profile,\"onboardingCompleted\":true}"; expect 200 profile_persisted
[[ $(printf %s "$RESPONSE"|jq -r .preferences.profile.trainingExperience) == three_to_five_years ]] || { echo FAIL profile_round_trip; exit 1; }; echo PASS profile_round_trip
request GET /api/consent "$jar"; expect 200 consent; version=$(printf %s "$RESPONSE"|jq -r .consent.consentVersion)
request PATCH /api/consent "$jar" "{\"schemaVersion\":\"1.0.0\",\"expectedConsentVersion\":$version,\"mutationId\":\"consent-$suffix\",\"changes\":[{\"signal\":\"manual_training\",\"enabled\":true}]}"; expect 200 training_consent
request POST /api/training/describe "$jar" '{"description":"Session: Lower body\nBack squat: 2x5 warm-up at 40kg, 3x5 at 80kg RPE 7 with 2 min rest"}'; expect 200 deterministic_description
[[ $(printf %s "$RESPONSE"|jq -r .saved) == false ]] || { echo FAIL parser_saved; exit 1; }; [[ $(printf %s "$RESPONSE"|jq '.interpretation.exercises[0].sets|length') == 5 ]] || { echo FAIL parser_sets; exit 1; }; echo PASS parser_transparent_unsaved
request GET /api/training/sessions "$jar"; expect 200 no_parser_autosave; [[ $(printf %s "$RESPONSE"|jq '.sessions|length') == 0 ]] || { echo FAIL parser_autosaved; exit 1; }
first_day="$(date -u -d '14 days ago' +%F)"; first_id="first-$suffix"
first_payload=$(jq -nc --arg id "$first_id" --arg start "${first_day}T17:00:00.000Z" --arg end "${first_day}T18:00:00.000Z" --arg mutation "first-mutation-$suffix" '{schemaVersion:"1.0.0",id:$id,title:"First press",status:"completed",inputDataMode:"manual",startedAt:$start,endedAt:$end,notes:"",revision:0,mutationId:$mutation,exercises:[{id:"first-ex",order:0,name:"Overhead press",notes:"",sets:[{id:"first-work",order:0,type:"working",loadKg:40,reps:5,rpe:null,notes:"",completed:true,completedAt:$end,restStartedAt:null,restDurationSeconds:120,restPausedRemainingSeconds:null}]}]}')
request POST /api/training/sessions "$jar" "$first_payload"; expect 201 first_completed
request GET "/api/training/sessions/$first_id" "$jar"; expect 200 first_session_summary; [[ $(printf %s "$RESPONSE"|jq -r '.comparison.prior == null') == true ]] || { echo FAIL first_session_not_neutral; exit 1; }; echo PASS first_session_summary_is_neutral
prior_start="${prior_day}T17:00:00.000Z"; prior_end="${prior_day}T18:00:00.000Z"; prior_id="prior-$suffix"
prior_payload=$(jq -nc --arg id "$prior_id" --arg start "$prior_start" --arg end "$prior_end" --arg mutation "prior-mutation-$suffix" '{schemaVersion:"1.0.0",id:$id,title:"Prior lower",status:"completed",inputDataMode:"manual",startedAt:$start,endedAt:$end,notes:"",revision:0,mutationId:$mutation,exercises:[{id:"prior-ex",order:0,name:"Back squat",notes:"",sets:[{id:"prior-warm",order:0,type:"warm_up",loadKg:40,reps:8,rpe:null,notes:"",completed:true,completedAt:$start,restStartedAt:null,restDurationSeconds:75,restPausedRemainingSeconds:null},{id:"prior-work",order:1,type:"working",loadKg:80,reps:5,rpe:7,notes:"",completed:true,completedAt:$end,restStartedAt:null,restDurationSeconds:120,restPausedRemainingSeconds:null}]}]}')
request POST /api/training/sessions "$jar" "$prior_payload"; expect 201 prior_completed
current_id="current-$suffix"; mutation_create="create-$suffix"
current_payload=$(jq -nc --arg id "$current_id" --arg mutation "$mutation_create" '{schemaVersion:"1.0.0",id:$id,title:"Current lower",status:"draft",inputDataMode:"manual",startedAt:null,endedAt:null,notes:"Typed values stay in the draft",revision:0,mutationId:$mutation,exercises:[{id:"current-ex",order:0,name:"Back squat",notes:"tempo controlled",sets:[{id:"current-warm",order:0,type:"warm_up",loadKg:40,reps:8,rpe:null,notes:"warm-up changed type",completed:false,completedAt:null,restStartedAt:null,restDurationSeconds:75,restPausedRemainingSeconds:null},{id:"current-work",order:1,type:"working",loadKg:82.5,reps:5,rpe:7.5,notes:"entered before save",completed:false,completedAt:null,restStartedAt:null,restDurationSeconds:120,restPausedRemainingSeconds:null}]}]}')
request POST /api/training/sessions "$jar" "$current_payload"; expect 201 draft_created; revision=$(printf %s "$RESPONSE"|jq -r .session.revision)
started="$(date -u -d '35 seconds ago' +%Y-%m-%dT%H:%M:%S.000Z)"; completed_at="$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
ticked=$(printf %s "$RESPONSE" | jq -c --arg started "$started" --arg completed "$completed_at" --arg mutation "tick-$suffix" '.session | del(.createdAt,.updatedAt) | .status="active" | .startedAt=$started | .mutationId=$mutation | .exercises[0].sets[0].completed=true | .exercises[0].sets[0].completedAt=$completed | .exercises[0].sets[0].restStartedAt=$started')
request PATCH "/api/training/sessions/$current_id" "$jar" "$ticked"; expect 200 tick_and_timer_persisted; revision=$(printf %s "$RESPONSE"|jq -r .session.revision)
request GET "/api/training/sessions/$current_id" "$jar"; expect 200 reload_draft; [[ $(printf %s "$RESPONSE"|jq -r .session.exercises[0].sets[0].type) == warm_up ]] || { echo FAIL set_type; exit 1; }; [[ $(printf %s "$RESPONSE"|jq -r .session.exercises[0].sets[0].restStartedAt) == "$started" ]] || { echo FAIL timer_timestamp_reload; exit 1; }; echo PASS set_type_and_timestamp_survive_reload
conflict=$(printf %s "$RESPONSE"|jq -c --arg mutation "conflict-$suffix" '.session | del(.createdAt,.updatedAt) | .revision=0 | .mutationId=$mutation | .notes="client input retained after failed save"')
request PATCH "/api/training/sessions/$current_id" "$jar" "$conflict"; expect 409 version_conflict_failed_write
request GET "/api/training/sessions/$current_id" "$jar"; expect 200 server_unchanged_after_failed_write; [[ $(printf %s "$RESPONSE"|jq -r .session.notes) == 'Typed values stay in the draft' ]] || { echo FAIL failed_write_mutated_server; exit 1; }; echo PASS failed_write_does_not_mutate_saved_draft
complete_time="$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"; completion_mutation="complete-$suffix"
complete=$(printf %s "$RESPONSE"|jq -c --arg ended "$complete_time" --arg mutation "$completion_mutation" '.session | del(.createdAt,.updatedAt) | .status="completed" | .endedAt=$ended | .mutationId=$mutation | .exercises[0].sets[1].completed=true | .exercises[0].sets[1].completedAt=$ended | .exercises[0].sets[1].restStartedAt=$ended')
request PATCH "/api/training/sessions/$current_id" "$jar" "$complete"; expect 200 complete_once; completion_response="$RESPONSE"; completed_revision=$(printf %s "$RESPONSE"|jq -r .session.revision)
request PATCH "/api/training/sessions/$current_id" "$jar" "$complete"; expect 200 repeat_same_completion_idempotent; [[ $(printf %s "$RESPONSE"|jq -r .session.revision) == "$completed_revision" ]] || { echo FAIL repeat_incremented_revision; exit 1; }
complete2=$(printf %s "$completion_response"|jq -c --arg mutation "complete-second-$suffix" '.session | del(.createdAt,.updatedAt) | .mutationId=$mutation')
request PATCH "/api/training/sessions/$current_id" "$jar" "$complete2"; expect 200 second_completion_new_mutation; second_revision=$(printf %s "$RESPONSE"|jq -r .session.revision); [[ "$second_revision" == $((completed_revision+1)) ]] || { echo FAIL second_completion_revision; exit 1; }
request GET "/api/training/sessions/$current_id" "$jar"; expect 200 completed_detail_summary; [[ $(printf %s "$RESPONSE"|jq -r .comparison.prior.sessionId) == "$prior_id" ]] || { echo FAIL prior_comparison; exit 1; }; echo PASS actual_prior_comparable_summary
request GET "/api/dashboard?date=$today" "$jar"; expect 200 dashboard_after_completion; [[ $(printf %s "$RESPONSE"|jq -r '.dashboard.metrics[]|select(.key=="session_volume")|.value') == 412.5 ]] || { echo FAIL dashboard_training_volume body=$RESPONSE; exit 1; }; echo PASS dashboard_reflects_saved_session
set -a; source "$ROOT/code/brioweb/.env.local"; set +a
workout_count=$(psql "$DATABASE_URL" -Atc "select count(*) from workouts where user_id='$user_id' and external_id='brio-session:$current_id'")
[[ "$workout_count" == 1 ]] || { echo FAIL duplicate_projection count=$workout_count; exit 1; }; echo PASS completion_projects_exactly_one_workout
signup "$fake_jar" "$fake_email"
cd "$ROOT/code/brioweb"
npm run generate:fake-app -- --email "$fake_email" --days 14 --confirmSynthetic > "$TMP/generator1"; cat "$TMP/generator1"
request GET "/api/dashboard?date=$today" "$fake_jar"; expect 200 synthetic_dashboard; synthetic_metrics=$(printf %s "$RESPONSE"|jq '[.dashboard.metrics[]|select(.provenance.inputDataMode=="synthetic_input")]|length'); [[ "$synthetic_metrics" -ge 6 ]] || { echo FAIL synthetic_provenance count=$synthetic_metrics body=$RESPONSE; exit 1; }; [[ $(printf %s "$RESPONSE"|jq -r '.dashboard.sourceStatuses[]|select(.sourceKey=="synthetic_fixture")|.state') == simulated ]] || { echo FAIL synthetic_status; exit 1; }; [[ $(printf %s "$RESPONSE"|jq -r '.dashboard.sourceStatuses[]|select(.sourceKey=="apple_health_helper")|.sampleCount') == 0 ]] || { echo FAIL synthetic_blended_as_apple; exit 1; }; echo PASS synthetic_inputs_separate_from_live_sources
request GET /api/export "$fake_jar"; expect 200 synthetic_export_before; before_counts=$(printf %s "$RESPONSE"|jq -c '{health:(.healthSamples|length),sessions:(.trainingSessions|length),manual:(.manualLogs|length),checks:(.checkIns|length)}')
npm run generate:fake-app -- --email "$fake_email" --days 14 --confirmSynthetic > "$TMP/generator2"
request GET /api/export "$fake_jar"; expect 200 synthetic_export_after; after_counts=$(printf %s "$RESPONSE"|jq -c '{health:(.healthSamples|length),sessions:(.trainingSessions|length),manual:(.manualLogs|length),checks:(.checkIns|length)}')
[[ "$before_counts" == "$after_counts" ]] || { echo FAIL synthetic_rerun_not_idempotent before=$before_counts after=$after_counts; exit 1; }; echo PASS synthetic_generator_idempotent
set +e
npm run generate:fake-app -- --email "$email" --days 14 --confirmSynthetic > "$TMP/generator-refusal" 2>&1; refusal=$?
set -e
[[ "$refusal" -ne 0 ]] || { echo FAIL generator_mixed_without_confirmation; exit 1; }; rg -q 'Refusing to mix synthetic fixtures' "$TMP/generator-refusal" || { cat "$TMP/generator-refusal"; echo FAIL refusal_message; exit 1; }; echo PASS generator_refuses_silent_real_account_mix
echo 'P10 V2 TRAINING INTEGRATION COMPLETE'
