import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('native scenes leave window creation to the scene delegate', () => {
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
