#!/usr/bin/env bash
# Prints the push function's public URL (https://…), or nothing if it isn't deployed yet.
# Used by the Pages build so the app knows where to subscribe and its CSP allows that one origin (030).
set -uo pipefail
REGION="${SCW_DEFAULT_REGION:-fr-par}"
NS_ID=$(scw function namespace list name=atomic region="$REGION" -o json 2>/dev/null | jq -r '[.[] | select(.name == "atomic")][0].id // empty')
[ -z "$NS_ID" ] && exit 0
DOMAIN=$(scw function function list namespace-id="$NS_ID" name=atomic-push region="$REGION" -o json 2>/dev/null | jq -r '[.[] | select(.name == "atomic-push")][0].domain_name // empty')
[ -n "$DOMAIN" ] && echo "https://$DOMAIN"
exit 0
