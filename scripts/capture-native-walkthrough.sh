#!/usr/bin/env bash
set -euo pipefail

output=build/native-walkthrough
mkdir -p "$output"
device=$(xcrun simctl list devices available --json | jq -r '.devices | to_entries[] | select(.key | endswith("iOS-27-0")) | .value[] | select(.name == "iPhone Air") | .udid' | head -1)
test -n "$device"
video_pid=
audio_pid=
test_pid=
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
  xcrun simctl io "$device" screenshot --mask=black "$output/final-frame.png" 2>/dev/null || true
  if [ -n "$test_pid" ]; then
    kill -TERM "$test_pid" 2>/dev/null || true
    sleep 2
    kill -KILL "$test_pid" 2>/dev/null || true
    wait "$test_pid" 2>/dev/null || true
  fi
  # The hosted runner disposes the device. Do not block export on Xcode teardown.
}
trap cleanup EXIT
xcodebuild -project ios/App/App.xcodeproj -scheme NativeWalkthrough \
  -destination "platform=iOS Simulator,id=$device" -configuration Release \
  -derivedDataPath build/WalkthroughDerivedData CODE_SIGNING_ALLOWED=NO \
  ONLY_ACTIVE_ARCH=YES build-for-testing > "$output/build.log" 2>&1
xcrun simctl boot "$device"
xcrun simctl bootstatus "$device" -b
# Xcode 27 uses Device Hub. Its default input mode has no hardware keyboard.
open -b com.apple.dt.Devices
xcrun simctl io "$device" recordVideo --codec=h264 --mask=black "$output/screen.mov" > "$output/video.log" 2>&1 &
video_pid=$!
ffmpeg -hide_banner -nostats -y -f avfoundation -i ':BlackHole 2ch' -af 'aresample=async=1:first_pts=0' -c:a pcm_s16le "$output/audio.wav" > "$output/audio.log" 2>&1 &
audio_pid=$!
# AVFoundation initialization can lag process launch by a minute on a cold host.
# Anchor each track when it reports readiness, not when its process was spawned.
python3 - "$output" "$video_pid" "$audio_pid" <<'PYREADY'
from pathlib import Path
import os
import sys
import time
folder = Path(sys.argv[1])
pending = [('video', 'Recording started', int(sys.argv[2])),
           ('audio', "Output #0, wav", int(sys.argv[3]))]
deadline = time.monotonic() + 120
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
xcodebuild -project ios/App/App.xcodeproj -scheme NativeWalkthrough \
  -destination "platform=iOS Simulator,id=$device" -configuration Release \
  -derivedDataPath build/WalkthroughDerivedData -resultBundlePath "$output/result.xcresult" \
  -parallel-testing-enabled NO -test-timeouts-enabled YES \
  -maximum-test-execution-time-allowance 900 CODE_SIGNING_ALLOWED=NO test-without-building \
  > "$output/test.log" 2>&1 &
test_pid=$!
# Xcode 27 can hang after XCTest has finished. The suite result is authoritative;
# stop capture immediately instead of leaving minutes of dead footage at the end.
for attempt in $(seq 1 600); do
  if grep -Eq "Test Suite 'All tests' (passed|failed)" "$output/test.log"; then break; fi
  if ! kill -0 "$test_pid" 2>/dev/null; then break; fi
  sleep 2
done
cleanup
video_pid=
audio_pid=
trap - EXIT
grep -q "Test Suite 'All tests' passed" "$output/test.log"
python3 scripts/assemble-native-walkthrough.py "$output" "$(git rev-parse HEAD)"
