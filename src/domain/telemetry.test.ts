import { describe, it, expect } from 'vitest'
import { telemetryPayloadSchema, computeMonthlyUserHash } from './telemetry'

describe('telemetryPayloadSchema', () => {
  it('validates a complete payload', () => {
    const parsed = telemetryPayloadSchema.parse({
      deviceId: 'dev-123456789',
      platform: 'ios',
      os: 'iOS 18.0',
      browser: 'Mobile Safari',
      deviceType: 'mobile',
      engagementTier: 'active',
    })
    expect(parsed.deviceId).toBe('dev-123456789')
    expect(parsed.platform).toBe('ios')
    expect(parsed.engagementTier).toBe('active')
  })

  it('supplies safe defaults for omitted optional fields', () => {
    const parsed = telemetryPayloadSchema.parse({
      deviceId: 'dev-abcdef123',
    })
    expect(parsed.platform).toBe('unknown')
    expect(parsed.os).toBe('unknown')
    expect(parsed.browser).toBe('unknown')
    expect(parsed.deviceType).toBe('unknown')
    expect(parsed.engagementTier).toBe('casual')
  })

  it('rejects deviceId shorter than 6 characters', () => {
    expect(() =>
      telemetryPayloadSchema.parse({
        deviceId: 'short',
      }),
    ).toThrow()
  })

  it('rejects invalid engagement tier', () => {
    expect(() =>
      telemetryPayloadSchema.parse({
        deviceId: 'dev-abcdef123',
        engagementTier: 'invalid-tier',
      }),
    ).toThrow()
  })
})

describe('computeMonthlyUserHash', () => {
  it('produces deterministic 64-char hex SHA-256 hash', async () => {
    const hash1 = await computeMonthlyUserHash('dev-test', '2026-09', 'salt')
    const hash2 = await computeMonthlyUserHash('dev-test', '2026-09', 'salt')
    expect(hash1).toBe(hash2)
    expect(hash1).toHaveLength(64)
  })

  it('rotates when the month changes', async () => {
    const sep = await computeMonthlyUserHash('dev-test', '2026-09', 'salt')
    const oct = await computeMonthlyUserHash('dev-test', '2026-10', 'salt')
    expect(sep).not.toBe(oct)
  })

  it('changes when the deviceId changes', async () => {
    const devA = await computeMonthlyUserHash('dev-a', '2026-09', 'salt')
    const devB = await computeMonthlyUserHash('dev-b', '2026-09', 'salt')
    expect(devA).not.toBe(devB)
  })
})
