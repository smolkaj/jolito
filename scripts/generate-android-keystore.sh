#!/usr/bin/env bash
set -euo pipefail

# Deterministic helper to generate an upload keystore for Google Play Store releases.
# The resulting keystore is saved locally (and gitignored) and instructions are provided
# to encode it as GitHub Actions repository secrets.

KEYSTORE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_FILE="${1:-"$KEYSTORE_DIR/jolito-upload.keystore"}"
KEY_ALIAS="${2:-"jolito-upload"}"

echo "=========================================================="
echo " Jolito Android Upload Keystore Generator"
echo "=========================================================="
echo "Output keystore: $OUTPUT_FILE"
echo "Key alias:       $KEY_ALIAS"
echo ""

if [ -f "$OUTPUT_FILE" ]; then
  echo "Error: Keystore already exists at $OUTPUT_FILE" >&2
  echo "Refusing to overwrite existing keystore." >&2
  exit 1
fi

# Generate 24-character random password if not provided in environment
KEYSTORE_PASS="${ANDROID_KEYSTORE_PASSWORD:-$(head -c 32 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 24)}"

echo "Generating PKCS12 upload keystore with 2048-bit RSA key (valid for 25 years / 10,000 days)..."

keytool -genkeypair \
  -v \
  -storetype PKCS12 \
  -keystore "$OUTPUT_FILE" \
  -storepass "$KEYSTORE_PASS" \
  -alias "$KEY_ALIAS" \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -dname "CN=Jolito, OU=Mobile, O=Jolito, L=San Francisco, ST=California, C=US"

chmod 0600 "$OUTPUT_FILE"

echo ""
echo "✔ Keystore generated successfully: $OUTPUT_FILE (mode 0600)"
echo ""
echo "To configure GitHub Actions repository secrets for automated Play Store release builds, run:"
echo "----------------------------------------------------------------------------------------"
echo "gh secret set ANDROID_KEYSTORE_BASE64 < <(base64 -w 0 \"$OUTPUT_FILE\")"
echo "gh secret set ANDROID_KEYSTORE_PASSWORD --body \"$KEYSTORE_PASS\""
echo "gh secret set ANDROID_KEY_ALIAS --body \"$KEY_ALIAS\""
echo "gh secret set ANDROID_KEY_PASSWORD --body \"$KEYSTORE_PASS\""
echo "----------------------------------------------------------------------------------------"
echo "Keep your keystore file and passwords safe in an offline password manager."
echo "Google Play requires this key (or Play App Signing) to verify all future app updates."
