#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

signup() {
  local label="$1"
  local email="$2"
  local username="$3"
  local jar="$4"
  local body="$WORK_DIR/${label}-signup.json"
  local status
  status=$(curl -sS -c "$jar" -b "$jar" -o "$body" -w '%{http_code}' \
    -H 'content-type: application/json' \
    -X POST "$BASE_URL/api/auth/sign-up/email" \
    --data "{\"name\":\"P01 ${label}\",\"email\":\"${email}\",\"username\":\"${username}\",\"password\":\"Local-only-pass-42!\"}")
  printf 'signup_%s_status=%s\n' "$label" "$status"
  if [[ "$status" -lt 200 || "$status" -ge 300 ]]; then
    printf 'signup_%s_error_body=%s\n' "$label" "$(tr -d '\n' < "$body" | head -c 240)"
    return 1
  fi
}

post_sample() {
  local label="$1"
  local jar="$2"
  local payload="$3"
  local body="$WORK_DIR/${label}-post.json"
  local status
  status=$(curl -sS -c "$jar" -b "$jar" -o "$body" -w '%{http_code}' \
    -H 'content-type: application/json' \
    -X POST "$BASE_URL/api/health-samples" --data "$payload")
  printf '%s_status=%s response=%s\n' "$label" "$status" "$(tr -d '\n' < "$body" | head -c 300)"
}

get_samples() {
  local label="$1"
  local jar="$2"
  local type="$3"
  local body="$WORK_DIR/${label}-get.json"
  local status
  status=$(curl -sS -c "$jar" -b "$jar" -o "$body" -w '%{http_code}' \
    "$BASE_URL/api/health-samples?sampleType=${type}")
  printf '%s_status=%s response=%s\n' "$label" "$status" "$(tr -d '\n' < "$body" | head -c 500)"
}

suffix="$(date +%s)$$"
jar_a="$WORK_DIR/a.cookies"
jar_b="$WORK_DIR/b.cookies"
signup a "p01-a-${suffix}@example.test" "p01a${suffix}" "$jar_a"
signup b "p01-b-${suffix}@example.test" "p01b${suffix}" "$jar_b"

post_sample a_single "$jar_a" '{"externalId":"p01-collision","sampleType":"HKQuantityTypeIdentifierStepCount","value":1111,"unit":"count","startDate":"2026-09-10T10:00:00.000Z","endDate":"2026-09-10T11:00:00.000Z","sourceName":"P01 device A"}'
post_sample a_array "$jar_a" '[{"externalId":"p01-array","sampleType":"HKQuantityTypeIdentifierActiveEnergyBurned","value":222,"unit":"kcal","startDate":"2026-09-10T12:00:00.000Z","endDate":"2026-09-10T13:00:00.000Z","sourceName":"P01 device A"}]'
post_sample a_wrapped "$jar_a" '{"samples":[{"externalId":"p01-wrapper","sampleType":"HKQuantityTypeIdentifierHeartRate","value":70,"unit":"count/min","startDate":"2026-09-10T14:00:00.000Z","endDate":"2026-09-10T14:01:00.000Z","sourceName":"P01 device A"}]}'
post_sample b_collision "$jar_b" '{"externalId":"p01-collision","sampleType":"HKQuantityTypeIdentifierStepCount","value":9999,"unit":"count","startDate":"2026-09-11T10:00:00.000Z","endDate":"2026-09-11T11:00:00.000Z","sourceName":"P01 device B"}'

get_samples a_steps "$jar_a" 'HKQuantityTypeIdentifierStepCount'
get_samples b_steps "$jar_b" 'HKQuantityTypeIdentifierStepCount'
get_samples a_energy "$jar_a" 'HKQuantityTypeIdentifierActiveEnergyBurned'
get_samples a_hr "$jar_a" 'HKQuantityTypeIdentifierHeartRate'

printf 'database_collision_rows=' 
PGPASSWORD="$(sed -n 's|^DATABASE_URL=postgresql://brio_dev:\([^@]*\)@.*|\1|p' /home/ubuntu/work/BRIO/code/brioweb/.env.local)" \
  psql -h 127.0.0.1 -U brio_dev -d brio_dev -Atc "select count(*) from health_samples where external_id = 'p01-collision';"
printf 'database_collision_owner_and_value=' 
PGPASSWORD="$(sed -n 's|^DATABASE_URL=postgresql://brio_dev:\([^@]*\)@.*|\1|p' /home/ubuntu/work/BRIO/code/brioweb/.env.local)" \
  psql -h 127.0.0.1 -U brio_dev -d brio_dev -Atc "select left(user_id,8) || ':' || value from health_samples where external_id = 'p01-collision';"
