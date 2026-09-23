import Foundation
import Capacitor
import AVFoundation

@objc(NativeSpeechPlugin)
public class NativeSpeechPlugin: CAPPlugin, CAPBridgedPlugin, AVSpeechSynthesizerDelegate {
    public let identifier = "NativeSpeechPlugin"
    public let jsName = "NativeSpeech"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "speak", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getVoices", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise)
    ]

    private let synthesizer = AVSpeechSynthesizer()
    private var activeCall: CAPPluginCall?

    override public func load() {
        super.load()
        synthesizer.delegate = self
    }

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": true])
    }

    @objc func getVoices(_ call: CAPPluginCall) {
        let voices = AVSpeechSynthesisVoice.speechVoices().map { voice in
            var qualityStr = "default"
            if #available(iOS 16.0, *) {
                switch voice.quality {
                case .premium:
                    qualityStr = "premium"
                case .enhanced:
                    qualityStr = "enhanced"
                default:
                    qualityStr = "default"
                }
            }
            var genderStr = "unspecified"
            if #available(iOS 13.0, *) {
                switch voice.gender {
                case .male:
                    genderStr = "male"
                case .female:
                    genderStr = "female"
                default:
                    genderStr = "unspecified"
                }
            }
            return [
                "identifier": voice.identifier,
                "name": voice.name,
                "language": voice.language,
                "quality": qualityStr,
                "gender": genderStr
            ]
        }
        call.resolve(["voices": voices])
    }

    @objc func speak(_ call: CAPPluginCall) {
        guard let text = call.getString("text"), !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            call.reject("Text is required")
            return
        }

        let locale = call.getString("locale") ?? "es-MX"
        // Web rates are centered around 1.0. AVSpeechUtteranceDefaultSpeechRate is ~0.5.
        // Map caller's rate (e.g. 0.88 or 1.0) so 1.0 corresponds to AVSpeechUtteranceDefaultSpeechRate.
        let requestedRate = call.getFloat("rate") ?? (locale.lowercased().hasPrefix("es") ? 0.88 : 0.92)
        let rate = requestedRate * AVSpeechUtteranceDefaultSpeechRate
        let pitch = call.getFloat("pitch") ?? 1.0
        let gender = call.getString("gender")
        let voiceIdentifier = call.getString("voice")

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }

            if self.synthesizer.isSpeaking {
                self.synthesizer.stopSpeaking(at: .immediate)
                if let prevCall = self.activeCall {
                    prevCall.resolve(["completed": false, "interrupted": true])
                    self.activeCall = nil
                }
            }

            let utterance = AVSpeechUtterance(string: text)
            utterance.rate = min(max(rate, AVSpeechUtteranceMinimumSpeechRate), AVSpeechUtteranceMaximumSpeechRate)
            utterance.pitchMultiplier = min(max(pitch, 0.5), 2.0)
            utterance.volume = 1.0
            utterance.voice = self.selectVoice(locale: locale, preferredGender: gender, preferredVoice: voiceIdentifier)

            self.activeCall = call
            self.synthesizer.speak(utterance)
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            if self.synthesizer.isSpeaking {
                self.synthesizer.stopSpeaking(at: .immediate)
            }
            if let prevCall = self.activeCall {
                prevCall.resolve(["completed": false, "interrupted": true])
                self.activeCall = nil
            }
            call.resolve(["stopped": true])
        }
    }

    private func selectVoice(locale: String, preferredGender: String?, preferredVoice: String?) -> AVSpeechSynthesisVoice? {
        let allVoices = AVSpeechSynthesisVoice.speechVoices()

        // 1. Explicit voice identifier match
        if let preferredVoice = preferredVoice, !preferredVoice.isEmpty {
            if let matched = allVoices.first(where: {
                $0.identifier == preferredVoice || $0.name.caseInsensitiveCompare(preferredVoice) == .orderedSame
            }) {
                return matched
            }
        }

        let normalizedTarget = locale.replacingOccurrences(of: "_", with: "-").lowercased()

        // 2. Filter matching target locale or language prefix
        let localeMatches = allVoices.filter {
            $0.language.replacingOccurrences(of: "_", with: "-").lowercased() == normalizedTarget
        }
        let pool = !localeMatches.isEmpty ? localeMatches : allVoices.filter {
            $0.language.replacingOccurrences(of: "_", with: "-").lowercased().hasPrefix(String(normalizedTarget.prefix(2)))
        }

        // 3. Filter by gender if requested
        let genderPool: [AVSpeechSynthesisVoice]
        if let preferredGender = preferredGender, #available(iOS 13.0, *) {
            let targetGender: AVSpeechSynthesisVoiceGender = preferredGender == "male" ? .male : .female
            let matchingGender = pool.filter { $0.gender == targetGender }
            genderPool = !matchingGender.isEmpty ? matchingGender : pool
        } else {
            genderPool = pool
        }

        // 4. Quality sorting: prefer premium, then enhanced
        if #available(iOS 16.0, *) {
            if let premium = genderPool.first(where: { $0.quality == .premium }) {
                return premium
            }
            if let enhanced = genderPool.first(where: { $0.quality == .enhanced }) {
                return enhanced
            }
        }

        // 5. Prefer Mexican names like Paulina or Jorge
        if let mexicanNamed = genderPool.first(where: {
            let name = $0.name.lowercased()
            return name.contains("paulina") || name.contains("jorge")
        }) {
            return mexicanNamed
        }

        return genderPool.first ?? AVSpeechSynthesisVoice(language: locale)
    }

    // MARK: - AVSpeechSynthesizerDelegate

    public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        if let call = activeCall {
            call.resolve(["completed": true, "interrupted": false])
            activeCall = nil
        }
        notifyListeners("speechFinished", data: ["text": utterance.speechString])
    }

    public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        if let call = activeCall {
            call.resolve(["completed": false, "interrupted": true])
            activeCall = nil
        }
        notifyListeners("speechCancelled", data: ["text": utterance.speechString])
    }
}
