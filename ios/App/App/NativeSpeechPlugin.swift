import Foundation
import Capacitor
import AVFoundation
import UIKit

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
    private var activeUtterance: AVSpeechUtterance?

    override public func load() {
        super.load()
        synthesizer.delegate = self
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleAppDidEnterBackground),
            name: UIApplication.didEnterBackgroundNotification,
            object: nil
        )
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    @objc private func handleAppDidEnterBackground() {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            if self.synthesizer.isSpeaking || self.activeUtterance != nil {
                self.synthesizer.stopSpeaking(at: .immediate)
            }
            if let call = self.activeCall {
                self.activeCall = nil
                self.activeUtterance = nil
                call.resolve(["completed": false, "interrupted": true])
            }
        }
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
        let requestedRate = call.getFloat("rate") ?? (locale.lowercased().hasPrefix("es") ? 0.88 : 0.92)
        let rate = requestedRate * AVSpeechUtteranceDefaultSpeechRate
        let pitch = call.getFloat("pitch") ?? 1.0
        let gender = call.getString("gender")
        let voiceIdentifier = call.getString("voice")
        let explicit = call.getBool("explicit") ?? false

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }

            // Configure audio session category based on explicit user intent:
            // Explicit clicks override silent mode (.playback); auto-play respects silent mode (.ambient)
            do {
                let audioSession = AVAudioSession.sharedInstance()
                let category: AVAudioSession.Category = explicit ? .playback : .ambient
                try audioSession.setCategory(category, mode: .spokenAudio, options: [.mixWithOthers])
                try audioSession.setActive(true)
            } catch {
                // Non-fatal: continue synthesis attempt
            }

            if #available(iOS 16.0, *) {
                self.synthesizer.usesApplicationAudioSession = true
            }

            if self.synthesizer.isSpeaking || self.activeUtterance != nil {
                self.synthesizer.stopSpeaking(at: .immediate)
                if let prevCall = self.activeCall {
                    self.activeCall = nil
                    self.activeUtterance = nil
                    prevCall.resolve(["completed": false, "interrupted": true])
                }
            }

            let utterance = AVSpeechUtterance(string: text)
            utterance.rate = min(max(rate, AVSpeechUtteranceMinimumSpeechRate), AVSpeechUtteranceMaximumSpeechRate)
            utterance.pitchMultiplier = min(max(pitch, 0.5), 2.0)
            utterance.volume = 1.0
            utterance.voice = self.selectVoice(locale: locale, preferredGender: gender, preferredVoice: voiceIdentifier)

            self.activeCall = call
            self.activeUtterance = utterance
            self.synthesizer.speak(utterance)
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            if self.synthesizer.isSpeaking || self.activeUtterance != nil {
                self.synthesizer.stopSpeaking(at: .immediate)
            }
            if let prevCall = self.activeCall {
                self.activeCall = nil
                self.activeUtterance = nil
                prevCall.resolve(["completed": false, "interrupted": true])
            }
            do {
                let audioSession = AVAudioSession.sharedInstance()
                try audioSession.setCategory(.ambient, mode: .spokenAudio, options: [.mixWithOthers])
            } catch {}
            call.resolve(["stopped": true])
        }
    }

    private func isRoboticOrNoveltyVoice(_ voice: AVSpeechSynthesisVoice) -> Bool {
        let identifier = voice.identifier.lowercased()
        // Apple Eloquence synthesizer voices (1990s robotic screen-reader voices added in iOS 16)
        if identifier.contains("eloquence") {
            return true
        }
        // Legacy novelty synthesizers (Zarvox, Bad News, etc.)
        // Note: Apple's natural English voice Alex has identifier "com.apple.speech.synthesis.voice.Alex",
        // so we must never filter Alex.
        if identifier.contains("speech.synthesis.voice") && !identifier.contains("alex") {
            return true
        }

        let name = voice.name.lowercased()
        let roboticNames: Set<String> = [
            "eddy", "floyd", "grandpa", "grandma", "reed", "rocko", "sandy", "shelley",
            "bad news", "bahh", "bells", "boing", "bubbles", "cellos", "deranged",
            "good news", "hysterical", "junior", "pipe organ", "trinoids", "whisper",
            "wobble", "zarvox", "albert", "fred", "organ", "kathy", "ralph", "bruce", "princess"
        ]
        return roboticNames.contains(name)
    }

    private func selectVoice(locale: String, preferredGender: String?, preferredVoice: String?) -> AVSpeechSynthesisVoice? {
        let allVoices = AVSpeechSynthesisVoice.speechVoices()
        let naturalVoices = allVoices.filter { !self.isRoboticOrNoveltyVoice($0) }
        let candidateVoices = naturalVoices.isEmpty ? allVoices : naturalVoices

        // 1. Explicit voice identifier or name match
        if let preferredVoice = preferredVoice, !preferredVoice.isEmpty {
            let targetLang = String(locale.replacingOccurrences(of: "_", with: "-").lowercased().prefix(2))
            let langCandidates = candidateVoices.filter {
                $0.language.replacingOccurrences(of: "_", with: "-").lowercased().hasPrefix(targetLang)
            }
            let pool = langCandidates.isEmpty ? candidateVoices : langCandidates

            // Prefer guaranteed installed .default quality voices over un-downloaded premium/enhanced catalog voices
            let sortedPool: [AVSpeechSynthesisVoice]
            if #available(iOS 16.0, *) {
                sortedPool = pool.sorted {
                    let rank: (AVSpeechSynthesisVoiceQuality) -> Int = { q in
                        switch q {
                        case .default: return 2
                        case .enhanced: return 1
                        case .premium: return 0
                        @unknown default: return 0
                        }
                    }
                    return rank($0.quality) > rank($1.quality)
                }
            } else {
                sortedPool = pool
            }

            // 1a. Exact identifier match
            if let matched = sortedPool.first(where: {
                $0.identifier == preferredVoice
            }) {
                return matched
            }
            // 1b. Exact name match (case-insensitive)
            if let matched = sortedPool.first(where: {
                $0.name.caseInsensitiveCompare(preferredVoice) == .orderedSame
            }) {
                return matched
            }
            // 1c. Jolito neural persona name hints (e.g. "es-MX-JorgeNeural" -> Jorge, "es-MX-DaliaNeural" -> Paulina)
            let lowerPreferred = preferredVoice.lowercased()
            if lowerPreferred.contains("jorge") {
                if let jorge = sortedPool.first(where: {
                    $0.name.lowercased().contains("jorge") && $0.language.lowercased().hasPrefix("es")
                }) {
                    return jorge
                }
            } else if lowerPreferred.contains("dalia") || lowerPreferred.contains("paulina") {
                if let paulina = sortedPool.first(where: {
                    $0.name.lowercased().contains("paulina") && $0.language.lowercased().hasPrefix("es")
                }) {
                    return paulina
                }
            } else if lowerPreferred.contains("jenny") || lowerPreferred.contains("samantha") {
                if let samantha = sortedPool.first(where: {
                    $0.name.lowercased().contains("samantha") && $0.language.lowercased().hasPrefix("en")
                }) {
                    return samantha
                }
            } else if lowerPreferred.contains("guy") || lowerPreferred.contains("alex") {
                if let alex = sortedPool.first(where: {
                    $0.name.lowercased().contains("alex") && $0.language.lowercased().hasPrefix("en")
                }) {
                    return alex
                }
            }
        }

        let normalizedTarget = locale.replacingOccurrences(of: "_", with: "-").lowercased()
        let langPrefix = String(normalizedTarget.prefix(2))

        // 2. Filter matching target locale or language prefix
        let localeMatches = candidateVoices.filter {
            $0.language.replacingOccurrences(of: "_", with: "-").lowercased() == normalizedTarget
        }
        let langMatches = candidateVoices.filter {
            $0.language.replacingOccurrences(of: "_", with: "-").lowercased().hasPrefix(langPrefix)
        }

        // 3. Filter by gender if requested with cross-dialect fallback
        let genderPool: [AVSpeechSynthesisVoice]
        if let preferredGender = preferredGender, #available(iOS 13.0, *) {
            let targetGender: AVSpeechSynthesisVoiceGender = preferredGender == "male" ? .male : .female
            let localGenderMatches = localeMatches.filter { $0.gender == targetGender }
            if !localGenderMatches.isEmpty {
                genderPool = localGenderMatches
            } else {
                let broadGenderMatches = langMatches.filter { $0.gender == targetGender }
                genderPool = !broadGenderMatches.isEmpty ? broadGenderMatches : (!localeMatches.isEmpty ? localeMatches : langMatches)
            }
        } else {
            genderPool = !localeMatches.isEmpty ? localeMatches : langMatches
        }

        // 4. Prefer natural voices: Mexican names (Paulina, Jorge) for Spanish, natural names (Samantha, Alex, Ava, Allison) for English
        if langPrefix == "es" {
            let preferredSpanishNames = preferredGender == "male"
                ? ["jorge", "carlos", "diego", "juan", "raul"]
                : ["paulina", "mónica", "monica", "soledad", "francisca"]

            // 4a. Prioritize preferred natural names that are guaranteed installed (.default quality)
            if #available(iOS 16.0, *) {
                for name in preferredSpanishNames {
                    if let matched = genderPool.first(where: { $0.name.lowercased().contains(name) && $0.quality == .default }) {
                        return matched
                    }
                }
            }

            // 4b. Match preferred natural names across any available quality
            for name in preferredSpanishNames {
                if let matched = genderPool.first(where: { $0.name.lowercased().contains(name) }) {
                    return matched
                }
            }
            if let named = genderPool.first(where: {
                let n = $0.name.lowercased()
                return n.contains("paulina") || n.contains("jorge") || n.contains("monica") || n.contains("carlos")
            }) {
                return named
            }
        } else if langPrefix == "en" {
            let preferredEnglishNames = preferredGender == "male"
                ? ["alex", "tom", "aaron"]
                : ["samantha", "ava", "allison", "serena"]

            // 4a. Prioritize preferred natural names that are guaranteed installed (.default quality)
            if #available(iOS 16.0, *) {
                for name in preferredEnglishNames {
                    if let matched = genderPool.first(where: { $0.name.lowercased().contains(name) && $0.quality == .default }) {
                        return matched
                    }
                }
            }

            // 4b. Match preferred natural names across any available quality
            for name in preferredEnglishNames {
                if let matched = genderPool.first(where: { $0.name.lowercased().contains(name) }) {
                    return matched
                }
            }
            if let named = genderPool.first(where: {
                let n = $0.name.lowercased()
                return n.contains("samantha") || n.contains("alex") || n.contains("ava") || n.contains("allison")
            }) {
                return named
            }
        }

        // 5. Fallback pool: prefer guaranteed installed .default quality voices over un-downloaded enhanced/premium
        if #available(iOS 16.0, *) {
            if let defaultVoice = genderPool.first(where: { $0.quality == .default }) {
                return defaultVoice
            }
        }

        return genderPool.first ?? candidateVoices.first(where: { $0.language.replacingOccurrences(of: "_", with: "-").lowercased().hasPrefix(langPrefix) }) ?? AVSpeechSynthesisVoice(language: locale)
    }

    // MARK: - AVSpeechSynthesizerDelegate

    public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            guard utterance === self.activeUtterance, let call = self.activeCall else { return }
            self.activeCall = nil
            self.activeUtterance = nil
            do {
                let audioSession = AVAudioSession.sharedInstance()
                try audioSession.setCategory(.ambient, mode: .spokenAudio, options: [.mixWithOthers])
            } catch {}
            call.resolve(["completed": true, "interrupted": false])
        }
    }

    public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            guard utterance === self.activeUtterance, let call = self.activeCall else { return }
            self.activeCall = nil
            self.activeUtterance = nil
            do {
                let audioSession = AVAudioSession.sharedInstance()
                try audioSession.setCategory(.ambient, mode: .spokenAudio, options: [.mixWithOthers])
            } catch {}
            call.resolve(["completed": false, "interrupted": true])
        }
    }
}
