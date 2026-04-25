#!/usr/bin/env bash
# EAS / expo-updates require projectRoot = directory that contains app.json and package.json.
# Running `eas build` from chorehero-app/ios/ breaks with:
#   "The expected package.json path: .../ios/package.json does not exist"
# Always invoke EAS from the JavaScript app root (chorehero-app/).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
exec eas build --platform ios --profile production "$@"
