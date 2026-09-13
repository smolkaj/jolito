import { describe, it, expect } from 'vitest'
import { getManagedSenders } from '../../../scripts/setup-email'

describe('Email Routing Managed Senders', () => {
  it('returns canonical sender and signin aliases for a given domain', () => {
    const senders = getManagedSenders('joli.to')
    expect(senders).toEqual(['a@joli.to', 'signin@joli.to'])
  })

  it('handles subdomain environments cleanly', () => {
    const senders = getManagedSenders('preview.joli.to')
    expect(senders).toEqual(['a@preview.joli.to', 'signin@preview.joli.to'])
  })
})
