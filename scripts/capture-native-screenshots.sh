#!/usr/bin/env bash
set -euo pipefail

UDID="$1"
RESULT_BUNDLE="$2"
LABEL="${3:-device}"

for attempt in 1 2; do
  echo "::group::Capturing $LABEL screenshots (attempt $attempt/2)"
  xcrun simctl shutdown "$UDID" 2>/dev/null || true
  xcrun simctl erase "$UDID" 2>/dev/null || true
  xcrun simctl boot "$UDID"
  xcrun simctl bootstatus "$UDID" -b
  sleep 5
  xcrun simctl status_bar "$UDID" override --time '9:41' --dataNetwork wifi --wifiMode active --wifiBars 3 --batteryState charged --batteryLevel 100 2>/dev/null || true
  xcrun simctl spawn "$UDID" defaults write com.apple.Accessibility ReducedMotionEnabled -int 1 2>/dev/null || true
  xcrun simctl spawn "$UDID" defaults write -g UIAccessibilityReduceMotionStatus -int 1 2>/dev/null || true
  rm -rf "$RESULT_BUNDLE"

  if xcodebuild -project ios/App/App.xcodeproj -scheme NativeScreenshots \
    -destination "platform=iOS Simulator,id=$UDID" \
    -configuration Release -derivedDataPath build/DerivedData \
    -resultBundlePath "$RESULT_BUNDLE" \
    -parallel-testing-enabled NO -test-timeouts-enabled YES \
    -retry-tests-on-failure -test-iterations 3 \
    -default-test-execution-time-allowance 600 \
    CODE_SIGNING_ALLOWED=NO ONLY_ACTIVE_ARCH=YES test; then
    echo "Successfully captured $LABEL screenshots on attempt $attempt"
    xcrun simctl shutdown "$UDID" 2>/dev/null || true
    echo "::endgroup::"
    exit 0
  fi

  echo "::warning::Capture $LABEL failed on attempt $attempt"
  xcrun simctl shutdown "$UDID" 2>/dev/null || true
  xcrun simctl erase "$UDID" 2>/dev/null || true
  echo "::endgroup::"
  sleep 5
done

echo "::error::Capture $LABEL failed after 2 attempts"
exit 1
