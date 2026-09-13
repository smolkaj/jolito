import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const scriptPath = path.resolve('scripts/capture-native-screenshots.sh')

void test('capture-native-screenshots.sh exists and is executable', () => {
  assert.equal(fs.existsSync(scriptPath), true)
  const stats = fs.statSync(scriptPath)
  // Check executable bit (owner, group, or other)
  assert.equal((stats.mode & 0o111) !== 0, true)
})

void test('capture-native-screenshots.sh incorporates test-level and runner-level retries', () => {
  const content = fs.readFileSync(scriptPath, 'utf8')

  // Must retry tests in xcodebuild
  assert.match(content, /-retry-tests-on-failure/)
  assert.match(content, /-test-iterations 3/)

  // Must reset simulator state between attempts
  assert.match(content, /simctl erase/)
  assert.match(content, /simctl shutdown/)
  assert.match(content, /simctl bootstatus.*-b/)

  // Must attempt twice before exiting with failure
  assert.match(content, /for attempt in 1 2; do/)
  assert.match(content, /exit 1/)
})
