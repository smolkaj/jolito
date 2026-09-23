import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const scriptPath = fileURLToPath(
  new URL('../../scripts/capture-native-screenshots.sh', import.meta.url),
)

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

  // Must suppress continuous motion to prevent XCTest animation stalls
  assert.match(content, /ReducedMotionEnabled/)
  assert.match(content, /-default-test-execution-time-allowance 600/)

  // Must attempt twice before exiting with failure
  assert.match(content, /for attempt in 1 2; do/)
  assert.match(content, /exit 1/)
})

void test('ios.yml does not trigger slow native-screenshots on push to main', () => {
  const workflowPath = fileURLToPath(
    new URL('../../.github/workflows/ios.yml', import.meta.url),
  )
  const content = fs.readFileSync(workflowPath, 'utf8')

  // The native-screenshots job must not execute on every push to main,
  // which causes the Merge Coordinator to wait 20+ minutes for mainline settlement.
  assert.doesNotMatch(
    content,
    /github\.event_name\s*==\s*'push'\s*&&\s*github\.ref\s*==\s*'refs\/heads\/main'/,
  )

  // It should remain dispatchable and opt-in for PRs
  assert.match(content, /github\.event_name == 'workflow_dispatch'/)
  assert.match(content, /test-native/)
})
