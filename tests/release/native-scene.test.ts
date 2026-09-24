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

  const supabaseConfig = readFileSync(
    new URL('../../supabase/config.toml', import.meta.url),
    'utf8',
  )
  assert.match(supabaseConfig, /\[auth\.external\.apple\]/)
  assert.match(supabaseConfig, /enabled\s*=\s*true/)
  assert.match(supabaseConfig, /client_id\s*=\s*"to\.joli\.app"/)
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

void test('NativeSpeechPlugin filters out Eloquence and legacy novelty robotic synthesizers and prioritizes natural voices', () => {
  const speechPlugin = readFileSync(
    new URL('../../ios/App/App/NativeSpeechPlugin.swift', import.meta.url),
    'utf8',
  )

  // 1. Robotic and screen-reader synthesizers must be detected and filtered out
  assert.match(speechPlugin, /func isRoboticOrNoveltyVoice/)
  assert.match(speechPlugin, /identifier\.contains\("eloquence"\)/)
  assert.match(
    speechPlugin,
    /identifier\.contains\("speech\.synthesis\.voice"\)/,
  )
  assert.match(speechPlugin, /"eddy",\s*"floyd",\s*"grandpa"/)
  assert.match(speechPlugin, /"reed",\s*"rocko",\s*"sandy",\s*"shelley"/)

  // 2. Candidate voice pool excludes robotic synthesizers
  assert.match(
    speechPlugin,
    /let naturalVoices\s*=\s*allVoices\.filter\s*\{\s*!self\.isRoboticOrNoveltyVoice\(\$0\)\s*\}/,
  )

  // 3. Neural persona name hint mappings (Jorge, Paulina/Dalia, Samantha/Jenny, Alex/Guy)
  assert.match(speechPlugin, /lowerPreferred\.contains\("jorge"\)/)
  assert.match(
    speechPlugin,
    /lowerPreferred\.contains\("dalia"\)\s*\|\|\s*lowerPreferred\.contains\("paulina"\)/,
  )

  // 4. Preferred natural Spanish voices include Jorge and Paulina
  assert.match(
    speechPlugin,
    /preferredSpanishNames[\s\S]*?jorge[\s\S]*?paulina/,
  )
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

void test('Form inputs and textareas enforce minimum 16px font-size to prevent iOS WebKit automatic viewport zoom', () => {
  const css = readFileSync(
    new URL('../../src/styles.css', import.meta.url),
    'utf8',
  )

  // In iOS WebKit (Safari / WKWebView / Capacitor iOS), form inputs with font-size < 16px
  // trigger an unwanted automatic viewport zoom on focus.
  // 1. Verify global base rule enforces 16px on inputs, textareas, and selects
  assert.match(
    css,
    /input,\s*\n\s*textarea,\s*\n\s*select\s*\{[\s\S]*?font-size:\s*16px;/,
    'Base input, textarea, select must declare font-size: 16px to prevent iOS auto-zoom',
  )

  // 2. Verify additional context textareas declare font-size: 16px
  assert.match(
    css,
    /\.edit-card-form \.field-group textarea#edit-context,\s*\n\s*\.field-group textarea#context\s*\{[\s\S]*?font-size:\s*16px;/,
    'Additional context textareas (#context, #edit-context) must have font-size: 16px',
  )

  // 3. Statically audit all CSS rule blocks targeting input, textarea, or select: none may have font-size < 16px
  const rules = css.match(/[^{}]+{[^{}]+}/g) || []
  for (const rule of rules) {
    const [selector, body] = rule.split('{')
    const sel = selector!.trim()
    const isFormControl =
      /(?:^|[\s,>+~])(?:input|textarea|select)\b|\.feedback-textarea\b|\.delete-input\b|\.pill-select\b/.test(
        sel,
      ) &&
      !/(?:checkbox|radio|hidden|\.file-input-label|\.delete-input-label|\.paste-input-btn|\.deck-select-checkbox)/.test(
        sel,
      )

    if (isFormControl) {
      const fsMatch = body!.match(/font-size:\s*([0-9.]+)(px|rem)/)
      if (fsMatch) {
        const val = parseFloat(fsMatch[1]!)
        const unit = fsMatch[2]!
        const px = unit === 'rem' ? val * 16 : val
        assert.ok(
          px >= 16,
          `Selector "${sel}" declares font-size ${fsMatch[0]}, which is less than 16px and causes iOS WebKit auto-zoom`,
        )
      }
    }
  }
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

  const stringsXml = readFileSync(
    new URL(
      '../../android/app/src/main/res/values/strings.xml',
      import.meta.url,
    ),
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
  assert.match(manifest, /android:name="\.MainActivity"/)
  assert.match(manifest, /android\.permission\.INTERNET/)

  // Strings resources package name & app name
  assert.match(
    stringsXml,
    /<string name="package_name">to\.joli\.app<\/string>/,
  )
  assert.match(stringsXml, /<string name="app_name">Jolito<\/string>/)
})

void test('Universal keyboard avoidance architecture is registered at application root', () => {
  const mainTsx = readFileSync(
    new URL('../../src/main.tsx', import.meta.url),
    'utf8',
  )
  assert.match(
    mainTsx,
    /import\s*\{\s*initKeyboardAvoidance\s*\}\s*from\s*['"]\.\/infrastructure\/browser\/keyboard-avoidance['"]/,
    'main.tsx must import initKeyboardAvoidance',
  )
  assert.match(
    mainTsx,
    /initKeyboardDetection\(\)[\s\S]*?initKeyboardAvoidance\(\)/,
    'main.tsx must initialize initKeyboardAvoidance on app startup',
  )
})

void test('CSS architectural invariants for universal keyboard avoidance and reachability', () => {
  const css = readFileSync(
    new URL('../../src/styles.css', import.meta.url),
    'utf8',
  )

  // 1. :root declares --keyboard-inset default
  assert.match(
    css,
    /--keyboard-inset:\s*0px;/,
    ':root must declare --keyboard-inset: 0px',
  )

  // 2. Base .app-shell incorporates --keyboard-inset in padding-bottom
  assert.match(
    css,
    /\.app-shell\s*\{[\s\S]*?padding-bottom:\s*max\([\s\S]*?var\(--keyboard-inset,\s*0px\)/,
    'Base .app-shell must include var(--keyboard-inset, 0px) in padding-bottom',
  )

  // 3. Base .app-shell declares smooth padding-bottom transition
  assert.match(
    css,
    /\.app-shell\s*\{[\s\S]*?transition:\s*padding-bottom\s+240ms\s+cubic-bezier\(0\.16,\s*1,\s*0\.3,\s*1\);/,
    '.app-shell must declare transition on padding-bottom matching iOS keyboard curve',
  )

  // 4. Mobile .app-shell (under 680px) incorporates --keyboard-inset
  assert.match(
    css,
    /\.app-shell\s*\{[\s\S]*?88px[\s\S]*?var\(--safe-area-inset-bottom[\s\S]*?var\(--keyboard-inset,\s*0px\)/,
    'Mobile .app-shell must include var(--keyboard-inset, 0px) to clear bottom tab bar and keyboard',
  )

  // 5. Mobile tab bar is hidden when software keyboard is open
  assert.match(
    css,
    /(?:html\[data-keyboard-open=['"]true['"]\]\s*\.mobile-tab-bar|\.is-keyboard-open\s*\.mobile-tab-bar)\s*\{[\s\S]*?display:\s*none\s*!important;/,
    'Mobile tab bar must be suppressed when virtual keyboard is open',
  )

  // 6. prefers-reduced-motion suppresses .app-shell transitions
  assert.match(
    css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.app-shell[\s\S]*?transition:\s*none\s*!important;/,
    'prefers-reduced-motion must disable .app-shell transitions',
  )
})

void test('CSS dark mode architectural invariants and contrast tokens', () => {
  const css = readFileSync(
    new URL('../../src/styles.css', import.meta.url),
    'utf8',
  )

  // 1. Primary button in dark mode must use high-contrast dark text (WCAG AA > 4.5:1)
  assert.match(
    css,
    /:root\[data-theme=['"]dark['"]\]\s*\{[\s\S]*?--btn-primary-color:\s*var\(\s*--paper\s*\);/,
    ':root[data-theme="dark"] must set --btn-primary-color to var(--paper) for accessible contrast (>5.5:1) on Rosa Mexicano',
  )

  // 2. Suggestions container must use semantic var(--card) surface rather than hardcoded white
  assert.match(
    css,
    /\.suggestions-container\s*\{[\s\S]*?background:\s*var\(--card\);/,
    '.suggestions-container must use var(--card) to remain dark-mode compliant',
  )

  // 3. Grade buttons must not use !important on background so hover states illuminate smoothly
  assert.doesNotMatch(
    css,
    /\.grade-buttons\s+\.grade-again\s*\{[^}]*background:[^;]*!important;/,
    '.grade-buttons .grade-again must not use !important on background',
  )

  // 4. Toggle row hover must use semantic paper-deep to prevent light beige flashes
  assert.match(
    css,
    /\.toggle-row:hover\s*\{[\s\S]*?background:\s*var\(--paper-deep\);/,
    '.toggle-row:hover must use var(--paper-deep)',
  )

  // 5. Connection pill hovers must use semantic hover tokens
  assert.match(
    css,
    /\.connection-pill\.is-synced:hover\s*\{[\s\S]*?background:\s*var\(--turquesa-hover\);/,
    '.connection-pill.is-synced:hover must use var(--turquesa-hover)',
  )

  // 6. Duplicate badges must use semantic tokens to maintain WCAG AAA contrast in dark mode
  assert.match(
    css,
    /\.create-duplicate-badge\s*\{[^}]*background:\s*var\(--cempasuchil-soft\);/,
    '.create-duplicate-badge must use var(--cempasuchil-soft) to prevent low contrast in dark mode',
  )

  // 7. Auth banner action buttons must not invert to white background on hover in dark mode
  assert.doesNotMatch(
    css,
    /\.redirect-auth-banner\s+\.banner-action-btn:hover\s*\{[^}]*background:\s*#ffffff;/,
    '.redirect-auth-banner .banner-action-btn:hover must not use hardcoded #ffffff',
  )

  // 8. Dark mode must not activate automatically via prefers-color-scheme (dormant until opted in)
  assert.doesNotMatch(
    css,
    /@media\s*\(prefers-color-scheme:\s*dark\)/,
    'CSS must not auto-activate dark mode via prefers-color-scheme media query',
  )

  // 9. index.html must initialize data-theme="dark" when opted in via query param or localStorage
  const indexHtml = readFileSync(
    new URL('../../index.html', import.meta.url),
    'utf8',
  )
  assert.match(
    indexHtml,
    /theme === ['"]dark['"]/,
    'index.html must check theme query parameter for dark mode',
  )
  assert.match(
    indexHtml,
    /document\.documentElement\.setAttribute\(['"]data-theme['"],\s*['"]dark['"]\)/,
    'index.html must set data-theme="dark" attribute when opted in',
  )

  // 10. Primary button shadow token in dark mode must be a valid shadow color/token without length offsets
  assert.match(
    css,
    /:root\[data-theme=['"]dark['"]\]\s*\{[\s\S]*?--btn-primary-shadow:\s*var\(\s*--shadow-ink\s*\);/,
    ':root[data-theme="dark"] must set --btn-primary-shadow to var(--shadow-ink) without length offsets',
  )

  // 11. Danger buttons must use semantic tokens to maintain WCAG AA contrast in dark mode
  assert.match(
    css,
    /\.danger-button\s*\{[\s\S]*?background:\s*var\(--btn-danger-bg\);[\s\S]*?color:\s*var\(--btn-danger-color\);/,
    '.danger-button must use semantic --btn-danger-bg and --btn-danger-color',
  )

  // 12. Gesture card floods must use semantic flood color tokens
  assert.match(
    css,
    /\.gesture-card-flood\.zone-again\s*\{[\s\S]*?color:\s*var\(--flood-again-color\)\s*!important;/,
    '.gesture-card-flood.zone-again must use var(--flood-again-color)',
  )
})
