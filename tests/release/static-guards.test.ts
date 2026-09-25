import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ESLint } from 'eslint'

void test('ESLint resolves no-use-before-define error rule for source files', async () => {
  const eslint = new ESLint()
  const rawConfig = (await eslint.calculateConfigForFile('src/jolito.tsx')) as {
    rules?: Record<string, unknown>
  }
  const ruleConfig =
    rawConfig.rules?.['@typescript-eslint/no-use-before-define']

  assert.ok(
    ruleConfig,
    'Rule @typescript-eslint/no-use-before-define must be configured',
  )
  const severity = Array.isArray(ruleConfig)
    ? (ruleConfig[0] as unknown)
    : ruleConfig
  assert.ok(
    severity === 2 || severity === 'error',
    `Expected rule severity to be 'error' (2), got ${String(severity)}`,
  )

  const options = Array.isArray(ruleConfig)
    ? (ruleConfig[1] as Record<string, unknown>)
    : {}
  assert.strictEqual(
    options['variables'],
    true,
    'Variable references before declaration must be blocked',
  )
  assert.strictEqual(
    options['classes'],
    true,
    'Class references before declaration must be blocked',
  )
  assert.strictEqual(
    options['functions'],
    false,
    'Functions should remain hoisted and idiomatic',
  )
})

void test('ESLint catches Temporal Dead Zone variable access before definition', async () => {
  const eslint = new ESLint()
  const tdzCode = [
    'export function sampleView(): number {',
    '  function handleAction(): number {',
    '    if (isReady) return 1',
    '    return 0',
    '  }',
    '  const isReady = true',
    '  return handleAction()',
    '}',
  ].join('\n')

  const [result] = await eslint.lintText(tdzCode, {
    filePath: 'src/jolito.tsx',
  })
  assert.ok(result, 'Expected lint results from eslint.lintText')

  const tdzError = result.messages.find(
    (m) => m.ruleId === '@typescript-eslint/no-use-before-define',
  )
  assert.ok(
    tdzError,
    `Expected @typescript-eslint/no-use-before-define error for uninitialized variable, found: ${JSON.stringify(result.messages)}`,
  )
  assert.match(
    tdzError.message,
    /'isReady' was used before it was defined/,
    'Error message must indicate use-before-define on isReady',
  )
})
