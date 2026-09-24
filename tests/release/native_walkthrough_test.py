"""Exercise the real FFmpeg export with sparse frames and broken audio timelines."""
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]


def ffmpeg(*args):
    return subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', *args],
                          check=True, capture_output=True)


class NativeWalkthroughExport(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sources = tempfile.TemporaryDirectory()
        cls.source = Path(cls.sources.name)
        ffmpeg('-f', 'lavfi', '-i', 'color=c=red:s=16x16:r=1:d=205',
               '-vf', "drawbox=color=blue:t=fill:enable='gte(t,10)',drawbox=color=green:t=fill:enable='gte(t,200)',select='eq(n,0)+eq(n,10)+eq(n,200)+eq(n,204)'",
               '-fps_mode', 'vfr', '-c:v', 'libx264', str(cls.source / 'screen.mov'))
        for name, expression, duration in [
            ('complete', 'sin(440*2*PI*t)*0.2', 205),
            ('silent', '0', 205),
            ('fragmented', 'sin(440*2*PI*t)*0.2*lt(mod(t,0.2),0.02)', 205),
            ('truncated', 'sin(440*2*PI*t)*0.2', 150),
        ]:
            ffmpeg('-f', 'lavfi', '-i', f"aevalsrc='{expression}':s=8000:d={duration}",
                   '-c:a', 'pcm_s16le', str(cls.source / f'{name}.wav'))

    @classmethod
    def tearDownClass(cls):
        cls.sources.cleanup()

    def capture(self, folder, audio='complete', passed=True):
        shutil.copy(self.source / 'screen.mov', folder / 'screen.mov')
        shutil.copy(self.source / f'{audio}.wav', folder / 'audio.wav')
        (folder / 'video-start.txt').write_text('1000')
        (folder / 'audio-start.txt').write_text('1000')
        # Fractional cuts inside held frames reproduce the real Simulator issue.
        (folder / 'test.log').write_text('\n'.join([
            "Test Suite 'All tests' " + ('passed' if passed else 'failed'),
            'WALKTHROUGH_START 1005.37', 'WALKTHROUGH_END 1190.37',
            *[f'WALKTHROUGH_CHAPTER {1005.37 + i * 30} Chapter {i}' for i in range(6)],
        ]))
        return subprocess.run(['python3', str(ROOT / 'scripts/assemble-native-walkthrough.py'),
                               str(folder), 'fixture-source'], capture_output=True, text=True)

    def test_held_frames_survive_both_trim_boundaries(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            result = self.capture(folder)
            self.assertEqual(result.returncode, 0, result.stderr)
            manifest = json.loads((folder / 'native-walkthrough.json').read_text())
            self.assertEqual(manifest['durationSeconds'], 185)
            movie = folder / 'native-walkthrough.mp4'
            for time, channel in [('0', 0), ('184', 2)]:
                pixel = ffmpeg('-ss', time, '-i', str(movie), '-frames:v', '1',
                               '-vf', 'scale=1:1', '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-').stdout
                self.assertEqual(len(pixel), 3)
                self.assertGreater(pixel[channel], 200, f'Wrong held frame at {time}: {pixel}')

    def test_incomplete_or_inaudible_sources_cannot_publish(self):
        for audio, message in [('silent', 'silent or inaudible'),
                               ('fragmented', 'fragmented study audio'),
                               ('truncated', 'Source tracks must cover')]:
            with self.subTest(audio=audio), tempfile.TemporaryDirectory() as directory:
                folder = Path(directory)
                result = self.capture(folder, audio)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(message, result.stderr)
                self.assertFalse((folder / 'native-walkthrough.mp4').exists())

    def test_failed_ui_run_cannot_publish(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            result = self.capture(folder, passed=False)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('incomplete walkthrough', result.stderr)
            self.assertFalse((folder / 'native-walkthrough.mp4').exists())


if __name__ == '__main__':
    unittest.main()
