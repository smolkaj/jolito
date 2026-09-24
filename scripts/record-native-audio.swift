import AVFoundation
import Foundation

// Record the selected BlackHole input directly through Core Audio. A continuous
// PCM stream avoids dropped AVFoundation demuxer buffers and synthetic gap fill.
let folder = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let recorder = try AVAudioRecorder(url: folder.appendingPathComponent("audio.wav"), settings: [
    AVFormatIDKey: kAudioFormatLinearPCM,
    AVSampleRateKey: 48000,
    AVNumberOfChannelsKey: 2,
    AVLinearPCMBitDepthKey: 16,
    AVLinearPCMIsFloatKey: false,
    AVLinearPCMIsBigEndianKey: false
])
guard recorder.record() else { fatalError("Cannot start system audio recording") }
let start = Date().timeIntervalSince1970 - recorder.currentTime
try String(start).write(to: folder.appendingPathComponent("audio-start.txt"), atomically: true, encoding: .utf8)
print("Recording started")
fflush(stdout)
let signals = [SIGINT, SIGTERM].map { value -> DispatchSourceSignal in
    signal(value, SIG_IGN)
    let source = DispatchSource.makeSignalSource(signal: value, queue: .main)
    source.setEventHandler {
        recorder.stop()
        exit(0)
    }
    source.resume()
    return source
}
RunLoop.main.run()
