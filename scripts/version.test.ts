import { describe, expect, it } from 'vitest'
import { computeAppVersion } from './version'

describe('computeAppVersion', () => {
  it('produces a date-stamped version with commit or fallback hash', () => {
    const version = computeAppVersion()
    // Matches YYYY.MM.DD (hash-or-dev)
    expect(version).toMatch(/^\d{4}\.\d{2}\.\d{2} \([a-z0-9-]+\)$/)
  })
})
