import Foundation
import Capacitor
import Speech
import AVFoundation

@objc(SpeechRecognitionPlugin)
public class SpeechRecognitionPlugin: CAPPlugin, CAPBridgedPlugin, SFSpeechRecognizerDelegate {
    public let identifier = "SpeechRecognitionPlugin"
    public let jsName = "SpeechRecognition"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise)
    ]

    private var speechRecognizer: SFSpeechRecognizer?
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private let audioEngine = AVAudioEngine()
    private var isRecording = false
    private var isTapInstalled = false

    override public func load() {
        super.load()
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleDidEnterBackground),
            name: UIApplication.didEnterBackgroundNotification,
            object: nil
        )
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
        cleanupRecognition()
    }

    @objc private func handleDidEnterBackground() {
        DispatchQueue.main.async { [weak self] in
            guard let self = self, self.isRecording else { return }
            self.cleanupRecognition()
            self.notifyListeners("speechEnd", data: [:])
        }
    }

    @objc func isAvailable(_ call: CAPPluginCall) {
        let localeId = call.getString("locale") ?? "es-MX"
        let recognizer = SFSpeechRecognizer(locale: Locale(identifier: localeId))
        let available = recognizer?.isAvailable ?? false
        var supportsOnDevice = false
        if #available(iOS 13.0, *), let recognizer = recognizer {
            supportsOnDevice = recognizer.supportsOnDeviceRecognition
        }
        // Strict invariant: only report available if on-device offline recognition is supported
        call.resolve([
            "available": available && supportsOnDevice,
            "supportsOnDevice": supportsOnDevice
        ])
    }

    @objc override public func requestPermissions(_ call: CAPPluginCall) {
        SFSpeechRecognizer.requestAuthorization { speechStatus in
            let recordPermissionHandler: (Bool) -> Void = { micGranted in
                let granted = (speechStatus == .authorized) && micGranted
                call.resolve(["granted": granted])
            }
            if #available(iOS 17.0, *) {
                AVAudioApplication.requestRecordPermission(completionHandler: recordPermissionHandler)
            } else {
                AVAudioSession.sharedInstance().requestRecordPermission(recordPermissionHandler)
            }
        }
    }

    @objc func start(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }

            let localeId = call.getString("locale") ?? "es-MX"

            self.cleanupRecognition()

            let recognizer = SFSpeechRecognizer(locale: Locale(identifier: localeId))
            guard let recognizer = recognizer, recognizer.isAvailable else {
                call.reject("Speech recognizer unavailable for locale \(localeId)")
                return
            }

            guard recognizer.supportsOnDeviceRecognition else {
                call.reject("On-device speech recognition is not supported or offline assets are missing for \(localeId)")
                return
            }

            recognizer.delegate = self
            self.speechRecognizer = recognizer

            do {
                let session = AVAudioSession.sharedInstance()
                try session.setCategory(.playAndRecord, mode: .spokenAudio, options: [.defaultToSpeaker, .allowBluetoothHFP])
                try session.setActive(true, options: .notifyOthersOnDeactivation)
            } catch {
                call.reject("Failed to configure audio session: \(error.localizedDescription)")
                return
            }

            let request = SFSpeechAudioBufferRecognitionRequest()
            request.shouldReportPartialResults = true
            request.requiresOnDeviceRecognition = true
            self.recognitionRequest = request

            let node = self.audioEngine.inputNode
            let recordingFormat = node.outputFormat(forBus: 0)

            self.recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
                DispatchQueue.main.async {
                    guard let self = self else { return }
                    if let result = result {
                        let transcription = result.bestTranscription.formattedString
                        let isFinal = result.isFinal
                        self.notifyListeners("transcription", data: [
                            "text": transcription,
                            "isFinal": isFinal
                        ])
                    }
                    if error != nil || (result?.isFinal ?? false) {
                        self.cleanupRecognition()
                        self.notifyListeners("speechEnd", data: [:])
                    }
                }
            }

            node.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { [weak self] buffer, _ in
                self?.recognitionRequest?.append(buffer)
            }
            self.isTapInstalled = true

            do {
                try self.audioEngine.start()
                self.isRecording = true
                call.resolve(["started": true])
            } catch {
                self.cleanupRecognition()
                call.reject("Failed to start audio engine: \(error.localizedDescription)")
            }
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.cleanupRecognition()
            call.resolve(["stopped": true])
        }
    }

    private func cleanupRecognition() {
        if isTapInstalled {
            audioEngine.inputNode.removeTap(onBus: 0)
            isTapInstalled = false
        }
        if audioEngine.isRunning {
            audioEngine.stop()
        }
        recognitionRequest?.endAudio()
        recognitionRequest = nil
        recognitionTask?.cancel()
        recognitionTask = nil
        isRecording = false

        // Restore playback session for audio pronunciation
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .spokenAudio, options: [.mixWithOthers])
            try session.setActive(true)
        } catch {
            // Ignore session restore error
        }
    }
}
