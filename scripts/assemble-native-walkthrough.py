#!/usr/bin/env python3
"""Trim capture setup/teardown and synchronize the original native app audio."""
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
if len(chapters) < 6 or not 180 < end - start < 900:
    raise SystemExit('Walkthrough chapters or duration are incomplete')
video_offset = start - float((folder / 'video-start.txt').read_text())
audio_offset = start - float((folder / 'audio-start.txt').read_text())
if min(video_offset, audio_offset) < 0:
    raise SystemExit('Capture began after the walkthrough')

partial = folder / 'native-walkthrough.partial.mp4'
subprocess.run([
    'ffmpeg', '-hide_banner', '-loglevel', 'warning', '-y',
    '-ss', str(video_offset), '-i', str(folder / 'screen.mov'),
    '-ss', str(audio_offset), '-i', str(folder / 'audio.wav'),
    '-t', str(end - start), '-map', '0:v:0', '-map', '1:a:0',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k', '-af', 'apad', '-movflags', '+faststart', str(partial),
], check=True)
probe = json.loads(subprocess.check_output([
    'ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(partial)
]))
if {stream['codec_type'] for stream in probe['streams']} != {'audio', 'video'}:
    raise SystemExit('Final recording must contain both audio and video')
if abs(float(probe['format']['duration']) - (end - start)) > 1:
    raise SystemExit('Final recording does not cover the full walkthrough')
partial.replace(folder / 'native-walkthrough.mp4')
(folder / 'native-walkthrough.json').write_text(json.dumps({
    'capture': 'iOS Simulator — not a physical-device recording',
    'device': 'iPhone Air', 'operatingSystem': 'iOS 27.0',
    'sourceCommit': source, 'durationSeconds': round(end - start, 2),
    'authentication': 'Real production email-code authentication; dedicated reviewer and disposable deletion accounts',
    'audio': 'Original Simulator system audio via BlackHole; no voiceover or replacement speech',
    'presentation': 'Native device mask; setup/teardown trimmed; no added titles, borders or pointer overlays',
    'chapters': chapters,
}, indent=2) + '\n')
print('Assembled native-walkthrough.mp4; manual visual and audio review is still required.')
