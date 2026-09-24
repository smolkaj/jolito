#!/usr/bin/env bash
set -euo pipefail

output=build/native-walkthrough
mkdir -p "$output"
device=$(xcrun simctl list devices available --json | jq -r '.devices | to_entries[] | select(.key | endswith("iOS-26-2")) | .value[] | select(.name == "iPhone Air") | .udid' | head -1)
test -n "$device"
video_pid=
audio_pid=
cleanup() {
  if [ -n "$video_pid" ]; then kill -INT "$video_pid" 2>/dev/null || true; wait "$video_pid" || true; fi
  if [ -n "$audio_pid" ]; then kill -INT "$audio_pid" 2>/dev/null || true; wait "$audio_pid" || true; fi
  xcrun simctl shutdown "$device" 2>/dev/null || true
}
trap cleanup EXIT
xcrun simctl boot "$device"
xcrun simctl bootstatus "$device" -b
# Show the actual Simulator status bar, keyboard and app lifecycle.
open -a Simulator --args -CurrentDeviceUDID "$device"
defaults write com.apple.iphonesimulator ConnectHardwareKeyboard -bool false
xcodebuild -project ios/App/App.xcodeproj -scheme NativeWalkthrough \
  -destination "platform=iOS Simulator,id=$device" -configuration Release \
  -derivedDataPath build/WalkthroughDerivedData CODE_SIGNING_ALLOWED=NO \
  ONLY_ACTIVE_ARCH=YES build-for-testing > "$output/build.log" 2>&1
python3 -c 'import time; print(time.time())' > "$output/video-start.txt"
xcrun simctl io "$device" recordVideo --codec=h264 "$output/screen.mov" > "$output/video.log" 2>&1 &
video_pid=$!
python3 -c 'import time; print(time.time())' > "$output/audio-start.txt"
ffmpeg -hide_banner -y -f avfoundation -i ':BlackHole 2ch' -c:a pcm_s16le "$output/audio.wav" > "$output/audio.log" 2>&1 &
audio_pid=$!
sleep 3
kill -0 "$video_pid"
kill -0 "$audio_pid"
xcodebuild -project ios/App/App.xcodeproj -scheme NativeWalkthrough \
  -destination "platform=iOS Simulator,id=$device" -configuration Release \
  -derivedDataPath build/WalkthroughDerivedData -resultBundlePath "$output/result.xcresult" \
  -parallel-testing-enabled NO CODE_SIGNING_ALLOWED=NO test-without-building \
  > "$output/test.log" 2>&1
cleanup
video_pid=
audio_pid=
trap - EXIT
