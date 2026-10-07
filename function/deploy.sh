#!/usr/bin/env bash
# Creates or updates everything the push function needs on Scaleway (CLAUDE.md §2, §10). Safe to run again:
# each step looks for what already exists first. Runs in GitHub Actions with the SCW_* secrets as env vars.
# Never echo a secret here: GitHub masks them in logs, but only when they appear verbatim.
set -euo pipefail

# Report the failing step and Scaleway's own message as an annotation (readable without the full log).
STEP="setup"
ERRLOG=$(mktemp)
exec 2> >(tee -a "$ERRLOG" >&2)
trap 'echo "::error::Deploy failed at step: $STEP — $(tail -c 700 "$ERRLOG" | tr "\n" " ")"' ERR
step() { STEP="$1"; echo "▸ $1"; }
done_step() { echo "::notice::✓ $STEP${1:+ — $1}"; }

REGION="${SCW_DEFAULT_REGION:-fr-par}"
NAMESPACE="atomic"
FUNCTION="atomic-push"
BUCKET="atomic-push-${SCW_DEFAULT_PROJECT_ID:0:8}" # bucket names are global; the project prefix keeps it unique
ZIP="${1:?usage: deploy.sh path/to/function.zip}"

for name in SCW_ACCESS_KEY SCW_SECRET_KEY SCW_DEFAULT_PROJECT_ID SCW_DEFAULT_ORGANIZATION_ID ATOMIC_INVITE_CODE ATOMIC_APP_URL; do
  if [ -z "${!name:-}" ]; then echo "::error::Missing $name. Add it under Settings → Secrets and variables → Actions."; exit 1; fi
done

step "Storage bucket (062)"
if scw object bucket get "$BUCKET" region="$REGION" -o json >/dev/null 2>&1; then
  echo "  exists: $BUCKET"; done_step exists
else
  scw object bucket create name="$BUCKET" region="$REGION" -o json >/dev/null
  echo "  created: $BUCKET (private)"; done_step created
fi

step "Functions namespace"
NS_ID=$(scw function namespace list name="$NAMESPACE" region="$REGION" -o json | jq -r '[.[] | select(.name == "'"$NAMESPACE"'")][0].id // empty')
if [ -z "$NS_ID" ]; then
  NS_ID=$(scw function namespace create name="$NAMESPACE" region="$REGION" -w -o json | jq -r .id)
  echo "  created: $NS_ID"; done_step created
else
  echo "  exists: $NS_ID"; done_step exists
fi

# Settings shared by create and update. Secrets go in the host's secret store (§10), never in plain variables.
CONFIG=(
  runtime=node22 handler=handler.handle privacy=public http-option=redirected
  min-scale=0 max-scale=1 memory-limit=256 timeout=30s
  environment-variables.ATOMIC_BUCKET="$BUCKET"
  environment-variables.ATOMIC_REGION="$REGION"
  environment-variables.ATOMIC_APP_URL="$ATOMIC_APP_URL"
  secret-environment-variables.0.key=ATOMIC_S3_ACCESS_KEY secret-environment-variables.0.value="$SCW_ACCESS_KEY"
  secret-environment-variables.1.key=ATOMIC_S3_SECRET_KEY secret-environment-variables.1.value="$SCW_SECRET_KEY"
  secret-environment-variables.2.key=ATOMIC_INVITE_CODE secret-environment-variables.2.value="$ATOMIC_INVITE_CODE"
  region="$REGION"
)

step "Function"
FN_ID=$(scw function function list namespace-id="$NS_ID" name="$FUNCTION" region="$REGION" -o json | jq -r '[.[] | select(.name == "'"$FUNCTION"'")][0].id // empty')
if [ -z "$FN_ID" ]; then
  FN_ID=$(scw function function create name="$FUNCTION" namespace-id="$NS_ID" "${CONFIG[@]}" -o json | jq -r .id)
  echo "  created: $FN_ID"; done_step created
else
  scw function function update "$FN_ID" "${CONFIG[@]}" -o json >/dev/null
  echo "  settings updated: $FN_ID"; done_step updated
fi

step "Code upload"
scw function deploy namespace-id="$NS_ID" name="$FUNCTION" runtime=node22 zip-file="$ZIP" region="$REGION" -o json >/dev/null
echo "  deployed"; done_step

step "Every-minute timer"
CRONS=$(scw function cron list function-id="$FN_ID" region="$REGION" -o json | jq 'length')
if [ "$CRONS" = "0" ]; then
  scw function cron create function-id="$FN_ID" name=atomic-tick schedule='* * * * *' args='{"tick":true}' region="$REGION" -o json >/dev/null
  echo "  created: * * * * * (UTC; the 22:30 recap is converted per phone, E5)"; done_step created
else
  echo "  exists"; done_step exists
fi

step "Health check"
DOMAIN=$(scw function function get "$FN_ID" region="$REGION" -o json | jq -r .domain_name)
echo "  https://$DOMAIN/"
for attempt in $(seq 1 24); do
  if curl -fsS "https://$DOMAIN/" | grep -q '"service":"atomic-push"'; then
    echo "  ok"; done_step "https://$DOMAIN/"
    echo "### Push function is live" >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
    echo "https://$DOMAIN/" >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
    exit 0
  fi
  sleep 5
done
echo "::error::The function didn't answer at https://$DOMAIN/ within 2 minutes."
exit 1
