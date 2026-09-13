#!/usr/bin/env bash
set -euo pipefail
BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
JAR="$TMP/cookies"
LOGIN=$(curl -sS -c "$JAR" -b "$JAR" -o "$TMP/login" -w '%{http_code}' -H 'content-type: application/json' --data '{"email":"brio-ecp-demo@example.test","password":"Local-only-ECP-demo-42!"}' "$BASE_URL/api/auth/sign-in/email")
[[ "$LOGIN" == 200 ]] || { echo "FAIL login status=$LOGIN body=$(cat "$TMP/login")"; exit 1; }
echo 'PASS demo login'
PROMPT='Review my last 14 days across training, entered nutrition, sleep and recovery. Separate observations, uncertainty and cross-domain interactions. State that the inputs are synthetic demo data, then propose exactly one bounded Brio action.'
STATUS=$(curl -sS -N --max-time 180 -c "$JAR" -b "$JAR" -o "$TMP/chat" -w '%{http_code}' -H 'content-type: application/json' --data "$(jq -nc --arg prompt "$PROMPT" '{messages:[{role:"user",content:$prompt}]}')" "$BASE_URL/api/chat")
cat "$TMP/chat"
[[ "$STATUS" == 200 ]] || { echo "FAIL chat status=$STATUS"; exit 1; }
for agent in sleep training nutrition recovery; do
  jq -e -R -s --arg agent "$agent" 'split("\n") | map(select(length > 0) | fromjson) | any(.type == "agent_status" and .agent == $agent and .status == "started")' "$TMP/chat" >/dev/null || { echo "FAIL missing_agent=$agent"; exit 1; }
done
jq -e -R -s 'split("\n") | map(select(length > 0) | fromjson) | any(.type == "text")' "$TMP/chat" >/dev/null || { echo 'FAIL no_text'; exit 1; }
if jq -e -R -s 'split("\n") | map(select(length > 0) | fromjson) | any(.type == "error")' "$TMP/chat" >/dev/null; then echo 'FAIL agent_error'; exit 1; fi
TEXT=$(jq -R -s -r 'split("\n") | map(select(length > 0) | fromjson) | map(select(.type == "text") | .delta) | join("")' "$TMP/chat")
printf '\n--- synthesized answer ---\n%s\n' "$TEXT"
printf '%s' "$TEXT" | rg -qi 'synthetic' || { echo 'FAIL synthetic_disclosure'; exit 1; }
printf '%s' "$TEXT" | rg -q '\b(Progress|Maintain|Repeat|Reduce|Escalate)\b' || { echo 'FAIL bounded_action'; exit 1; }
if printf '%s' "$TEXT" | rg -qi 'MaxTurnsExceededError|specialist (agent )?calls? failed|data calls failed|could not retrieve any data|No (training|nutrition|sleep|recovery) data available'; then echo 'FAIL specialist_execution'; exit 1; fi
if printf '%s' "$TEXT" | rg -qi '\bHRV\b|sync[^.\n]*(workout|nutrition)|schedule[^.\n]*(review|follow-up)'; then echo 'FAIL unsupported_claim'; exit 1; fi
echo 'PASS live orchestrator called all four specialists, disclosed synthetic inputs, and returned a bounded action'
