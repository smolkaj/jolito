import { describe, expect, it, vi } from 'vitest'
import {
  canonicalizeUrl,
  enforceCanonicalHost,
  getCanonicalOrigin,
} from './host'

describe('canonicalizeUrl', () => {
  it('returns canonical https://joli.to URL when hostname is jolito.smolkaj.workers.dev', () => {
    const loc = new URL(
      'https://jolito.smolkaj.workers.dev/practice?filter=cdmx#access_token=abc123jwt&refresh_token=ref456',
    )
    expect(canonicalizeUrl(loc)).toBe(
      'https://joli.to/practice?filter=cdmx#access_token=abc123jwt&refresh_token=ref456',
    )
  })

  it('returns canonical https://joli.to URL when hostname is www.joli.to', () => {
    const loc = new URL('https://www.joli.to/#access_token=abc123jwt')
    expect(canonicalizeUrl(loc)).toBe('https://joli.to/#access_token=abc123jwt')
  })

  it('preserves root path and empty query/hash when canonicalizing', () => {
    const loc = new URL('http://jolito.smolkaj.workers.dev/')
    expect(canonicalizeUrl(loc)).toBe('https://joli.to/')
  })

  it('returns null when hostname is already joli.to', () => {
    const loc = new URL('https://joli.to/practice#access_token=abc')
    expect(canonicalizeUrl(loc)).toBeNull()
  })

  it('returns null for branch preview subdomains (e.g. agy-feature-jolito.smolkaj.workers.dev)', () => {
    const loc = new URL(
      'https://agy-feat-auth-jolito.smolkaj.workers.dev/practice#access_token=abc',
    )
    expect(canonicalizeUrl(loc)).toBeNull()
  })

  it('returns null for localhost and local network IPs', () => {
    expect(canonicalizeUrl(new URL('http://localhost:5173/'))).toBeNull()
    expect(canonicalizeUrl(new URL('http://127.0.0.1:4173/'))).toBeNull()
  })
})

describe('getCanonicalOrigin', () => {
  it('canonicalizes non-canonical production apex to https://joli.to', () => {
    expect(
      getCanonicalOrigin({
        hostname: 'jolito.smolkaj.workers.dev',
        origin: 'https://jolito.smolkaj.workers.dev',
      }),
    ).toBe('https://joli.to')
    expect(
      getCanonicalOrigin({
        hostname: 'www.joli.to',
        origin: 'https://www.joli.to',
      }),
    ).toBe('https://joli.to')
  })

  it('preserves origin for joli.to, branch previews, and localhost', () => {
    expect(
      getCanonicalOrigin({
        hostname: 'joli.to',
        origin: 'https://joli.to',
      }),
    ).toBe('https://joli.to')
    expect(
      getCanonicalOrigin({
        hostname: 'agy-branch-jolito.smolkaj.workers.dev',
        origin: 'https://agy-branch-jolito.smolkaj.workers.dev',
      }),
    ).toBe('https://agy-branch-jolito.smolkaj.workers.dev')
    expect(
      getCanonicalOrigin({
        hostname: 'localhost',
        origin: 'http://localhost:5173',
      }),
    ).toBe('http://localhost:5173')
  })

  it('returns undefined when location is null or has empty hostname', () => {
    expect(getCanonicalOrigin(null)).toBeUndefined()
    expect(getCanonicalOrigin({ hostname: '' })).toBeUndefined()
  })

  it('defaults to current window.location when no argument passed', () => {
    expect(getCanonicalOrigin()).toBe(window.location.origin)
  })
})

describe('enforceCanonicalHost', () => {
  it('redirects via location.replace when on non-canonical host', () => {
    const replaceMock = vi.fn()
    const mockLocation = {
      hostname: 'jolito.smolkaj.workers.dev',
      pathname: '/review',
      search: '?sort=due',
      hash: '#access_token=xyz',
      replace: replaceMock,
    } as unknown as Location

    const redirected = enforceCanonicalHost(mockLocation)
    expect(redirected).toBe(true)
    expect(replaceMock).toHaveBeenCalledWith(
      'https://joli.to/review?sort=due#access_token=xyz',
    )
  })

  it('does nothing and returns false when already on canonical host', () => {
    const replaceMock = vi.fn()
    const mockLocation = {
      hostname: 'joli.to',
      pathname: '/',
      search: '',
      hash: '',
      replace: replaceMock,
    } as unknown as Location

    const redirected = enforceCanonicalHost(mockLocation)
    expect(redirected).toBe(false)
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it('does nothing on preview branch worktree hosts', () => {
    const replaceMock = vi.fn()
    const mockLocation = {
      hostname: 'codex-sync-jolito.smolkaj.workers.dev',
      pathname: '/',
      search: '',
      hash: '',
      replace: replaceMock,
    } as unknown as Location

    const redirected = enforceCanonicalHost(mockLocation)
    expect(redirected).toBe(false)
    expect(replaceMock).not.toHaveBeenCalled()
  })
})
