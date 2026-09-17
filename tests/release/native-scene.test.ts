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

void test('release build configuration mandates Apple Distribution signing identity', () => {
  const pbxproj = readFileSync(
    new URL('../../ios/App/App.xcodeproj/project.pbxproj', import.meta.url),
    'utf8',
  )
  assert.match(
    pbxproj,
    /504EC3151FED79650016851F \/\* Release \*\/ = \{[\s\S]*?CODE_SIGN_IDENTITY = "Apple Distribution";/,
    'Project Release configuration must specify Apple Distribution',
  )

  const fastfile = readFileSync(
    new URL('../../fastlane/Fastfile', import.meta.url),
    'utf8',
  )
  assert.ok(
    fastfile.includes('default_keychain: true'),
    'Fastlane must set default_keychain: true for ephemeral signing keychain',
  )
  assert.ok(
    fastfile.includes('CODE_SIGN_IDENTITY=\\"Apple Distribution\\"'),
    'Fastlane build_app xcargs must explicitly override CODE_SIGN_IDENTITY',
  )
  assert.ok(
    fastfile.includes("set-key-partition-list"),
    'Fastlane must configure keychain partition list for headless codesign',
  )
})
