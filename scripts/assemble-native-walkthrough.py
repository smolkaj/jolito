#!/usr/bin/env python3
"""Trim capture setup/teardown and synchronize the original native app audio."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

folder = Path(sys.argv[1])
source = sys.argv[2]
log = (folder / 'test.log').read_text()
if "Test Suite 'All tests' passed" not in log:
    raise SystemExit('Refusing to publish an incomplete walkthrough')
start = float(re.findall(r'WALKTHROUGH_START ([0-9.]+)', log)[0])
end = float(re.findall(r'WALKTHROUGH_END ([0-9.]+)', log)[0])
chapters = [
    {'seconds': round(float(time) - start, 2), 'title': title.strip()}
    for time, title in re.findall(r'WALKTHROUGH_CHAPTER ([0-9.]+) ([^\r\n]+)', log)
]
if len(chapters) < 6 or not 180 < end - start < 1200:
    raise SystemExit('Walkthrough chapters or duration are incomplete')
video_offset = start - float((folder / 'video-start.txt').read_text())
audio_offset = start - float((folder / 'audio-start.txt').read_text())
if min(video_offset, audio_offset) < 0:
    raise SystemExit('Capture began after the walkthrough')

# Simulator emits a frame only when the display changes. Seeking directly to
# START drops a still Home Screen frame whose timestamp precedes that boundary.
# Sample the recorded display timeline before trimming so held images survive.
# First require real source coverage; fps must never conceal a short recording.
for filename, offset in [('screen.mov', video_offset), ('audio.wav', audio_offset)]:
    raw = json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error', '-show_streams', '-of', 'json', str(folder / filename)
    ]))
    if any(float(stream.get('start_time', 0)) > offset or
           float(stream.get('start_time', 0)) + float(stream.get('duration', 0)) < offset + end - start
           for stream in raw['streams']):
        raise SystemExit('Source tracks must cover the full walkthrough')

partial = folder / 'native-walkthrough.partial.mp4'
subprocess.run([
    'ffmpeg', '-hide_banner', '-loglevel', 'warning', '-y',
    '-i', str(folder / 'screen.mov'),
    '-ss', str(audio_offset), '-i', str(folder / 'audio.wav'),
    '-filter_complex', f'[0:v]fps=30,trim=start={video_offset}:duration={end - start},setpts=PTS-STARTPTS[video]',
    '-t', str(end - start), '-map', '[video]', '-map', '1:a:0',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', str(partial),
], check=True)
probe = json.loads(subprocess.check_output([
    'ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(partial)
]))
if {stream['codec_type'] for stream in probe['streams']} != {'audio', 'video'}:
    raise SystemExit('Final recording must contain both audio and video')
if any(float(stream.get('start_time', 0)) > 0.05 or
       abs(float(stream.get('duration', 0)) - (end - start)) > 1
       for stream in probe['streams']):
    raise SystemExit('Both tracks must cover the full walkthrough; refusing a truncated capture')
study_start = chapters[2]['seconds']
study_duration = chapters[4]['seconds'] - study_start
audio_check = subprocess.run([
    'ffmpeg', '-hide_banner', '-nostats', '-ss', str(study_start),
    '-i', str(partial), '-t', str(study_duration),
    '-vn', '-af', 'silencedetect=n=-50dB:d=0.08,volumedetect', '-f', 'null', '-',
], check=True, capture_output=True, text=True)
peak = re.search(r'max_volume: (-?[0-9.]+) dB', audio_check.stderr)
if not peak or float(peak[1]) < -45:
    raise SystemExit('Refusing a silent or inaudible recording')
# A few audible clicks or isolated surviving buffers are not usable study audio.
# Require a continuous sound interval as well as amplitude; manual review still
# verifies that the sound is the app's pronunciation, not merely an earcon.
sound_start = 0.0
longest_sound = 0.0
events = re.findall(r'silence_(start|end): ([0-9.]+)', audio_check.stderr)
for kind, value in events:
    if kind == 'start':
        longest_sound = max(longest_sound, float(value) - sound_start)
    else:
        sound_start = float(value)
if not events or events[-1][0] == 'end':
    longest_sound = max(longest_sound, study_duration - sound_start)
if longest_sound < 0.5:
    raise SystemExit('Refusing fragmented study audio; continuous pronunciation must survive capture')
partial.replace(folder / 'native-walkthrough.mp4')
(folder / 'native-walkthrough.json').write_text(json.dumps({
    'capture': 'iOS Simulator — not a physical-device recording',
    'device': 'iPhone Air', 'operatingSystem': 'iOS 27.0',
    'sha256': hashlib.sha256((folder / 'native-walkthrough.mp4').read_bytes()).hexdigest(),
    'sourceCommit': source, 'durationSeconds': round(end - start, 2),
    'authentication': 'Real production email-code authentication; dedicated reviewer and disposable deletion accounts',
    'audioPeakDb': float(peak[1]),
    'longestStudySoundSeconds': round(longest_sound, 3),
    'audio': 'Original Simulator system audio via BlackHole; no voiceover or replacement speech',
    'launch': 'Home Screen icon tap, resuming the warmed app',
    'presentation': 'Native device mask; setup/teardown trimmed; no added titles, borders or pointer overlays',
    'chapters': chapters,
}, indent=2) + '\n')
print('Assembled native-walkthrough.mp4; manual visual and audio review is still required.')
