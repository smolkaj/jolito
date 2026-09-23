import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

void test('native scenes leave window creation to the scene delegate', () => {
  const plist = readFileSync(
    new URL('../../ios/App/App/Info.plist', import.meta.url),
    'utf8',
  )
  const keys = Array.from(
    plist.matchAll(/<key>([^<]+)<\/key>/g),
    ([, key]) => key,
  )

  // A storyboard in either scope asks UIKit to construct an additional window
  // before the programmatic scene delegate installs the bundled web view.
  assert.ok(keys.includes('UISceneDelegateClassName'))
  assert.ok(!keys.includes('UIMainStoryboardFile'))
  assert.ok(!keys.includes('UISceneStoryboardFile'))
  assert.ok(keys.includes('UILaunchStoryboardName'))
})

void test('AppDelegate configures AVAudioSession with playback and mixWithOthers for language learning speech in silent mode', () => {
  const appDelegate = readFileSync(
    new URL('../../ios/App/App/AppDelegate.swift', import.meta.url),
    'utf8',
  )

  // Explicit pronunciation audio must play in silent mode without pausing background audio (e.g. podcasts/music)
  assert.match(
    appDelegate,
    /audioSession\.setCategory\(\.playback,\s*mode:\s*\.spokenAudio,\s*options:\s*\[\.mixWithOthers\]\)/,
  )
  assert.match(
    appDelegate,
    /applicationWillEnterForeground[\s\S]*?audioSession\.setCategory\(\.playback,\s*mode:\s*\.spokenAudio,\s*options:\s*\[\.mixWithOthers\]\)/,
  )
})

void test('SceneDelegate monitors GameController hardware keyboard connections and dispatches to web view', () => {
  const sceneDelegate = readFileSync(
    new URL('../../ios/App/App/SceneDelegate.swift', import.meta.url),
    'utf8',
  )

  assert.match(sceneDelegate, /import GameController/)
  assert.match(
    sceneDelegate,
    /NotificationCenter\.default\.addObserver[\s\S]*?\.GCKeyboardDidConnect/,
  )
  assert.match(
    sceneDelegate,
    /NotificationCenter\.default\.addObserver[\s\S]*?\.GCKeyboardDidDisconnect/,
  )
  assert.match(sceneDelegate, /GCKeyboard\.coalesced/)
  assert.match(sceneDelegate, /jolito:hardware-keyboard/)
  assert.match(sceneDelegate, /WKScriptMessageHandler/)
  assert.match(
    sceneDelegate,
    /userContentController\.add\(self,\s*name:\s*"jolitoKeyboard"\)/,
  )
  assert.match(
    sceneDelegate,
    /func userContentController[\s\S]*?message\.name == "jolitoKeyboard"/,
  )
  assert.match(
    sceneDelegate,
    /func sceneDidBecomeActive[\s\S]*?let isConnected = GCKeyboard\.coalesced != nil[\s\S]*?notifyKeyboardState\(connected: isConnected\)/,
  )
  assert.doesNotMatch(sceneDelegate, /removeAllUserScripts/)
})

void test('SceneDelegate registers AppReviewPlugin with StoreKit for native reviews', () => {
  const sceneDelegate = readFileSync(
    new URL('../../ios/App/App/SceneDelegate.swift', import.meta.url),
    'utf8',
  )
  const appReviewPlugin = readFileSync(
    new URL('../../ios/App/App/AppReviewPlugin.swift', import.meta.url),
    'utf8',
  )

  assert.match(
    sceneDelegate,
    /bridge\?\.registerPluginInstance\(AppReviewPlugin\(\)\)/,
  )
  assert.match(appReviewPlugin, /import StoreKit/)
  assert.match(appReviewPlugin, /@objc\(AppReviewPlugin\)/)
  assert.match(appReviewPlugin, /SKStoreReviewController\.requestReview/)
})

void test('SceneDelegate registers AppleSignInPlugin with AuthenticationServices and entitlements for native Apple Sign-In', () => {
  const sceneDelegate = readFileSync(
    new URL('../../ios/App/App/SceneDelegate.swift', import.meta.url),
    'utf8',
  )
  const applePlugin = readFileSync(
    new URL('../../ios/App/App/AppleSignInPlugin.swift', import.meta.url),
    'utf8',
  )
  const entitlements = readFileSync(
    new URL('../../ios/App/App/App.entitlements', import.meta.url),
    'utf8',
  )
  const pbxproj = readFileSync(
    new URL('../../ios/App/App.xcodeproj/project.pbxproj', import.meta.url),
    'utf8',
  )

  assert.match(
    sceneDelegate,
    /bridge\?\.registerPluginInstance\(AppleSignInPlugin\(\)\)/,
  )
  assert.match(applePlugin, /import AuthenticationServices/)
  assert.match(applePlugin, /import CryptoKit/)
  assert.match(applePlugin, /@objc\(AppleSignInPlugin\)/)
  assert.match(applePlugin, /ASAuthorizationAppleIDProvider/)
  assert.match(applePlugin, /ASAuthorizationControllerDelegate/)
  assert.match(applePlugin, /request\.nonce\s*=\s*sha256\(rawNonce\)/)
  assert.match(
    entitlements,
    /<key>com\.apple\.developer\.applesignin<\/key>\s*<array>\s*<string>Default<\/string>\s*<\/array>/,
  )
  assert.match(pbxproj, /CODE_SIGN_ENTITLEMENTS\s*=\s*App\/App\.entitlements;/)
})

void test('SceneDelegate registers NativeSpeechPlugin with AVFoundation for native speech synthesis', () => {
  const sceneDelegate = readFileSync(
    new URL('../../ios/App/App/SceneDelegate.swift', import.meta.url),
    'utf8',
  )
  const speechPlugin = readFileSync(
    new URL('../../ios/App/App/NativeSpeechPlugin.swift', import.meta.url),
    'utf8',
  )

  assert.match(
    sceneDelegate,
    /bridge\?\.registerPluginInstance\(NativeSpeechPlugin\(\)\)/,
  )
  assert.match(speechPlugin, /import AVFoundation/)
  assert.match(speechPlugin, /@objc\(NativeSpeechPlugin\)/)
  assert.match(speechPlugin, /AVSpeechSynthesizerDelegate/)
  assert.match(speechPlugin, /UIApplication\.didEnterBackgroundNotification/)
  assert.match(speechPlugin, /utterance\s*===\s*self\.activeUtterance/)
})

void test('SceneDelegate registers SpeechRecognitionPlugin with Speech and AVFoundation for spoken recall', () => {
  const sceneDelegate = readFileSync(
    new URL('../../ios/App/App/SceneDelegate.swift', import.meta.url),
    'utf8',
  )
  const speechRecognitionPlugin = readFileSync(
    new URL('../../ios/App/App/SpeechRecognitionPlugin.swift', import.meta.url),
    'utf8',
  )
  const plist = readFileSync(
    new URL('../../ios/App/App/Info.plist', import.meta.url),
    'utf8',
  )

  assert.match(
    sceneDelegate,
    /bridge\?\.registerPluginInstance\(SpeechRecognitionPlugin\(\)\)/,
  )
  assert.match(speechRecognitionPlugin, /import Speech/)
  assert.match(speechRecognitionPlugin, /import AVFoundation/)
  assert.match(speechRecognitionPlugin, /@objc\(SpeechRecognitionPlugin\)/)
  assert.match(speechRecognitionPlugin, /SFSpeechRecognizer/)
  assert.match(speechRecognitionPlugin, /SFSpeechAudioBufferRecognitionRequest/)
  assert.match(plist, /NSMicrophoneUsageDescription/)
  assert.match(plist, /NSSpeechRecognitionUsageDescription/)
})

void test('Capacitor iOS configuration uses contentInset: never to prevent double safe-area insetting', () => {
  const config = readFileSync(
    new URL('../../capacitor.config.ts', import.meta.url),
    'utf8',
  )
  const indexHtml = readFileSync(
    new URL('../../index.html', import.meta.url),
    'utf8',
  )

  // With viewport-fit=cover, CSS env(safe-area-inset-*) handles safe areas.
  // contentInset: 'never' prevents UIKit from dynamic double margins.
  assert.match(indexHtml, /viewport-fit=cover/)
  assert.match(config, /ios:\s*\{[\s\S]*?contentInset:\s*['"]never['"]/)
})

void test('SceneDelegate registers LiveActivityPlugin and Info.plist supports Live Activities', () => {
  const sceneDelegate = readFileSync(
    new URL('../../ios/App/App/SceneDelegate.swift', import.meta.url),
    'utf8',
  )
  const plist = readFileSync(
    new URL('../../ios/App/App/Info.plist', import.meta.url),
    'utf8',
  )

  assert.match(
    sceneDelegate,
    /bridge\?\.registerPluginInstance\(LiveActivityPlugin\(\)\)/,
  )
  assert.match(plist, /<key>NSSupportsLiveActivities<\/key>\s*<true\/>/)
})

void test('SceneDelegate registers ShareFilePlugin with UIActivityViewController for native file sharing', () => {
  const sceneDelegate = readFileSync(
    new URL('../../ios/App/App/SceneDelegate.swift', import.meta.url),
    'utf8',
  )
  const shareFilePlugin = readFileSync(
    new URL('../../ios/App/App/ShareFilePlugin.swift', import.meta.url),
    'utf8',
  )

  assert.match(
    sceneDelegate,
    /bridge\?\.registerPluginInstance\(ShareFilePlugin\(\)\)/,
  )
  assert.match(shareFilePlugin, /class ShareFilePlugin:\s*CAPPlugin/)
  assert.match(shareFilePlugin, /UIActivityViewController/)
  assert.match(shareFilePlugin, /popoverPresentationController/)
})

void test('Capacitor Android configuration matches appId and brand background', () => {
  const config = readFileSync(
    new URL('../../capacitor.config.ts', import.meta.url),
    'utf8',
  )
  const buildGradle = readFileSync(
    new URL('../../android/app/build.gradle', import.meta.url),
    'utf8',
  )
  const manifest = readFileSync(
    new URL('../../android/app/src/main/AndroidManifest.xml', import.meta.url),
    'utf8',
  )

  // App ID and Android scheme
  assert.match(config, /appId:\s*['"]to\.joli\.app['"]/)
  assert.match(config, /androidScheme:\s*['"]https['"]/)
  assert.match(
    config,
    /android:\s*\{[\s\S]*?backgroundColor:\s*['"]#fdf5f8['"]/,
  )

  // Gradle appId and namespace
  assert.match(buildGradle, /applicationId\s+['"]to\.joli\.app['"]/)
  assert.match(buildGradle, /namespace\s*=\s*['"]to\.joli\.app['"]/)

  // Manifest activity & permissions
  assert.match(manifest, /android\.permission\.INTERNET/)
})
