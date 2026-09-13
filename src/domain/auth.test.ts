import { describe, expect, it } from 'vitest'
import { unwrapDomainBoundOtp } from './auth'

describe('unwrapDomainBoundOtp', () => {
  it('extracts 6-digit code from domain-bound Apple/W3C syntax', () => {
    expect(unwrapDomainBoundOtp('@joli.to #482910')).toBe('482910')
    expect(unwrapDomainBoundOtp('@joli.to#482910')).toBe('482910')
    expect(unwrapDomainBoundOtp('  @joli.to #482910  ')).toBe('482910')
    expect(unwrapDomainBoundOtp('@example.com #123456')).toBe('123456')
  })

  it('tolerates whitespace and hyphens within domain-bound code', () => {
    expect(unwrapDomainBoundOtp('@joli.to # 482 910')).toBe('482910')
    expect(unwrapDomainBoundOtp('@joli.to # 482-910')).toBe('482910')
  })

  it('extracts 6-digit code from prefix-only hash syntax', () => {
    expect(unwrapDomainBoundOtp('#482910')).toBe('482910')
    expect(unwrapDomainBoundOtp('# 482910')).toBe('482910')
    expect(unwrapDomainBoundOtp('# 482 910')).toBe('482910')
    expect(unwrapDomainBoundOtp('# 482-910')).toBe('482910')
  })

  it('leaves raw 6-digit codes and magic link URLs intact', () => {
    expect(unwrapDomainBoundOtp('482910')).toBe('482910')
    expect(unwrapDomainBoundOtp('482-910')).toBe('482-910')
    expect(unwrapDomainBoundOtp('https://joli.to/#access_token=token123')).toBe(
      'https://joli.to/#access_token=token123',
    )
    expect(
      unwrapDomainBoundOtp(
        'https://example.supabase.co/auth/v1/verify?token=abc&type=magiclink',
      ),
    ).toBe(
      'https://example.supabase.co/auth/v1/verify?token=abc&type=magiclink',
    )
  })

  it('handles surrounding quotes and angle brackets', () => {
    expect(unwrapDomainBoundOtp('"@joli.to #482910"')).toBe('482910')
    expect(unwrapDomainBoundOtp("'@joli.to #482910'")).toBe('482910')
    expect(unwrapDomainBoundOtp('<@joli.to #482910>')).toBe('482910')
  })

  it('extracts domain-bound OTP from within a message sentence', () => {
    expect(
      unwrapDomainBoundOtp('Your verification code is: @joli.to #482910'),
    ).toBe('482910')
  })

  it('does not match codes with more than 6 digits', () => {
    expect(unwrapDomainBoundOtp('#1234567')).toBe('#1234567')
    expect(unwrapDomainBoundOtp('@joli.to #1234567')).toBe('@joli.to #1234567')
  })
})
