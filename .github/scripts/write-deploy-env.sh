#!/usr/bin/env bash
# Writes .env.app, the file every service's compose.yml reads on the Pi.
#
# One copy, called by all three deploy paths (release.yml, deploy-all.yml,
# deploy-single-service.yml). It used to be forty lines of `echo` repeated in
# each of them, which is how a variable ends up in two of the three: adding one
# meant remembering all the places, and nothing failed loudly when you did not.
#
# Every value arrives as an environment variable — the workflow maps secrets
# and vars onto these names. Nothing is read from the repository.
set -euo pipefail

# The names below are the whole contract. A service that needs a new one adds
# it here and in the `env:` block of each workflow that calls this.
KEYS=(
  MONGODB_URI
  JWT_SECRET
  API_KEY_ENCRYPTION_SECRET
  INTERNAL_SERVICE_TOKEN
  GOOGLE_CLIENT_ID
  GOOGLE_NATIVE_CLIENT_IDS
  COOKIE_DOMAIN
  CORS_ORIGIN
  ALPHA_VANTAGE_API_KEY
  GROUP_API_URL
  GROUP_INTERNAL_URL
  ALBUM_API_URL
  ALBUM_INTERNAL_URL
  AUTH_SERVICE_URL
  AUTH_FRONT_URL
  FINANCE_API_URL
  FINANCE_INTERNAL_URL
  RELATIONSHIP_FRONT_URL
  ALBUM_FRONT_URL
  FINANCE_FRONT_URL
  RELATIONSHIP_API_URL
  RELATIONSHIP_INTERNAL_URL
  MCP_PUBLIC_URL
  PUBLIC_API_URL
  PAYMENT_API_URL
  PAYMENT_INTERNAL_URL
  STRIPE_SECRET_KEY
  STRIPE_WEBHOOK_SECRET
  PAYMENT_FRONT_URL
  PAYMENT_URL
  GROUP_FRONT_URL
  CHAT_API_URL
  CHAT_FRONT_URL
  ACCOUNT_FRONT_URL
  SHELL_FRONT_URL
  FILE_SERVICE_URL
  FILE_SERVICE_API_KEY
  FILE_SERVICE_HMAC_SECRET
  FILE_SERVICE_PUBLIC_URL
  # Web Push, for chat notifications. The public key is handed to browsers; the
  # private key never leaves chat-service. All three empty means chat runs
  # without notifications rather than failing.
  VAPID_PUBLIC_KEY
  VAPID_PRIVATE_KEY
  VAPID_SUBJECT
  # Cloudflare's TURN relay, for calls. chat-service mints short-lived
  # credentials with these; both empty means calls fall back to STUN, which
  # fails between some networks but does not stop chat.
  CLOUDFLARE_TURN_KEY_ID
  CLOUDFLARE_TURN_API_TOKEN
)

OUT="${1:-.env.app}"
: > "$OUT"

missing=()
for key in "${KEYS[@]}"; do
  value="${!key-}"
  # Written even when empty, so compose sees the variable rather than warning
  # about an unset one — but an empty secret is worth saying out loud, since
  # the symptom otherwise shows up as a service failing minutes later.
  [ -n "$value" ] || missing+=("$key")
  printf '%s=%s\n' "$key" "$value" >> "$OUT"
done

if [ ${#missing[@]} -gt 0 ]; then
  echo "::warning::empty in this environment: ${missing[*]}"
fi

echo "Wrote $OUT with ${#KEYS[@]} variables."
