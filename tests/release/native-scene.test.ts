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
  // contentInset: 'never' prevents UIKit from adding duplicate safe-area margins.
  assert.match(indexHtml, /viewport-fit=cover/)
  assert.match(config, /ios:\s*\{[\s\S]*?contentInset:\s*['"]never['"]/)
})
