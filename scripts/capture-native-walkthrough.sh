#!/usr/bin/env bash
set -euo pipefail

output=build/native-walkthrough
mkdir -p "$output"
device=$(xcrun simctl list devices available --json | jq -r '.devices | to_entries[] | select(.key | endswith("iOS-27-0")) | .value[] | select(.name == "iPhone Air") | .udid' | head -1)
test -n "$device"
video_pid=
audio_pid=
test_pid=
ready_pid=
speech_log_pid=
cleanup() {
  for pid in "$video_pid" "$audio_pid"; do
    if [ -n "$pid" ]; then kill -INT "$pid" 2>/dev/null || true; fi
  done
  for attempt in $(seq 1 30); do
    if ! kill -0 "$video_pid" 2>/dev/null && ! kill -0 "$audio_pid" 2>/dev/null; then break; fi
    sleep 1
  done
  for pid in "$video_pid" "$audio_pid"; do
    if [ -n "$pid" ]; then kill -TERM "$pid" 2>/dev/null || true; fi
  done
  sleep 1
  for pid in "$video_pid" "$audio_pid"; do
    if [ -n "$pid" ]; then kill -KILL "$pid" 2>/dev/null || true; wait "$pid" || true; fi
  done
  python3 - "$device" "$output/final-frame.png" <<'PYSNAPSHOT'
import subprocess, sys
try:
    subprocess.run(['xcrun', 'simctl', 'io', sys.argv[1], 'screenshot',
                    '--mask=black', sys.argv[2]], timeout=10, capture_output=True)
except subprocess.TimeoutExpired:
    print('Final diagnostic screenshot timed out; continuing cleanup')
PYSNAPSHOT
  for pid in "$test_pid" "$ready_pid" "$speech_log_pid"; do
    if [ -n "$pid" ]; then
      kill -TERM "$pid" 2>/dev/null || true
      sleep 2
      kill -KILL "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
    fi
  done
  # The hosted runner disposes the device. Do not block export on Xcode teardown.
}
trap cleanup EXIT
swiftc scripts/record-native-audio.swift -o build/record-native-audio
xcodebuild -project ios/App/App.xcodeproj -scheme NativeWalkthrough \
  -destination "platform=iOS Simulator,id=$device" -configuration Release \
  -derivedDataPath build/WalkthroughDerivedData CODE_SIGNING_ALLOWED=NO \
  ONLY_ACTIVE_ARCH=YES build-for-testing > "$output/build.log" 2>&1
xcrun simctl boot "$device"
xcrun simctl bootstatus "$device" -b
# Keep the author's bilingual phrases literal, as with Auto-Correction disabled
# in Settings. These are device preferences, not changes to application state.
for preference in KeyboardAutocorrection KeyboardPrediction KeyboardShowPredictionBar; do
  xcrun simctl spawn "$device" defaults write com.apple.keyboard.preferences "$preference" -bool false
done
# Device Hub routes simulator audio to the host output. Do not use desktop
# Apple Events: those request host-control permission and block unattended runs.
open -b com.apple.dt.Devices
# The sandbox container is created on first launch; wait for that initialization.
keyboard_configured=false
for attempt in $(seq 1 30); do
  if defaults -container com.apple.dt.Devices write com.apple.dt.Devices alwaysSimulateHardwareKeyboard -bool false 2>/dev/null; then
    keyboard_configured=true
    break
  fi
  sleep 1
done
test "$keyboard_configured" = true
xcrun simctl spawn "$device" log stream --style compact --level error \
  --predicate 'subsystem CONTAINS[c] "speech" OR subsystem CONTAINS[c] "voice"' \
  > "$output/speech.log" 2>&1 &
speech_log_pid=$!
xcrun simctl io "$device" recordVideo --codec=h264 --mask=black "$output/screen.mov" > "$output/video.log" 2>&1 &
video_pid=$!
build/record-native-audio "$output" > "$output/audio.log" 2>&1 &
audio_pid=$!
# Anchor video at recorder readiness; the audio recorder writes its own clock.
# Monitor concurrently: XCTest must wake the device display and audio session.
python3 - "$output" "$video_pid" <<'PYREADY' &
from pathlib import Path
import os
import sys
import time
folder = Path(sys.argv[1])
pending = [('video', 'Recording started', int(sys.argv[2]))]
deadline = time.monotonic() + 180
while pending:
    for track, marker, pid in pending[:]:
        os.kill(pid, 0)
        log_file = folder / f'{track}.log'
        if log_file.exists() and marker in log_file.read_text():
            (folder / f'{track}-start.txt').write_text(str(time.time()))
            pending.remove((track, marker, pid))
    if time.monotonic() > deadline:
        raise SystemExit('Capture tools did not become ready')
    time.sleep(0.05)
PYREADY
ready_pid=$!
xcodebuild -project ios/App/App.xcodeproj -scheme NativeWalkthrough \
  -destination "platform=iOS Simulator,id=$device" -configuration Release \
  -derivedDataPath build/WalkthroughDerivedData -resultBundlePath "$output/result.xcresult" \
  -parallel-testing-enabled NO -test-timeouts-enabled YES \
  -maximum-test-execution-time-allowance 1200 CODE_SIGNING_ALLOWED=NO test-without-building \
  > >(tee "$output/test.log") 2>&1 &
test_pid=$!
# Xcode 27 can hang after XCTest has finished. The suite result is authoritative;
# stop capture immediately instead of leaving minutes of dead footage at the end.
for attempt in $(seq 1 660); do
  if grep -Eq "Test Suite 'All tests' (passed|failed)" "$output/test.log"; then break; fi
  if ! kill -0 "$test_pid" 2>/dev/null; then break; fi
  sleep 2
done
wait "$ready_pid"
test -s "$output/audio-start.txt"
cleanup
video_pid=
audio_pid=
trap - EXIT
grep -q "Test Suite 'All tests' passed" "$output/test.log"
python3 scripts/assemble-native-walkthrough.py "$output" "$(git rev-parse HEAD)"
