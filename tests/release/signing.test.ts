import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

void test('Xcode project release configuration specifies Apple Distribution identity', () => {
  const pbxproj = readFileSync(
    new URL('../../ios/App/App.xcodeproj/project.pbxproj', import.meta.url),
    'utf8',
  )
  assert.match(
    pbxproj,
    /504EC3151FED79650016851F \/\* Release \*\/ = \{[^}]*buildSettings = \{[^}]*CODE_SIGN_IDENTITY = "Apple Distribution";/,
    'Project Release configuration must specify Apple Distribution within its buildSettings block',
  )
})
