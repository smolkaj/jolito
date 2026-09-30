import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AppleApi } from '../../scripts/app-store.ts'
import {
  provisionAppProfile,
  APP_BUNDLE_ID,
  APP_PROFILE_NAME,
} from '../../scripts/provision-app.ts'

function record(type: string, id: string, attributes = {}, relationships = {}) {
  return { type, id, attributes, relationships }
}
const reply = (body: unknown) => Promise.resolve(Response.json(body))

void test('provisionAppProfile reuses existing bundle ID and profile when expiration matches', async () => {
  const existingProfileContent = Buffer.from(
    'mock-valid-profile-content with com.apple.developer.associated-domains entitlement',
  ).toString('base64')
  const futureDate = new Date(Date.now() + 86400000).toISOString()

  const calls: { url: URL; method: string }[] = []
  const mockFetch: typeof fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input)
    const method = init?.method ?? 'GET'
    calls.push({ url, method })

    if (url.pathname.includes('/bundleIdCapabilities')) {
      return reply({
        data: [
          record('bundleIdCapabilities', 'cap-1', {
            capabilityType: 'ASSOCIATED_DOMAINS',
          }),
        ],
      })
    }
    if (url.pathname.includes('/v1/bundleIds')) {
      return reply({
        data: [
          record('bundleIds', 'bundle-app', { identifier: APP_BUNDLE_ID }),
        ],
      })
    }
    if (url.pathname.includes('/v1/certificates')) {
      return reply({
        data: [
          record('certificates', 'cert-123', { expirationDate: futureDate }),
        ],
      })
    }
    if (url.pathname.includes('/v1/profiles')) {
      return reply({
        data: [
          record('profiles', 'prof-app-123', {
            name: APP_PROFILE_NAME,
            profileContent: existingProfileContent,
            expirationDate: futureDate,
          }),
        ],
      })
    }
    return Promise.reject(new Error(`Unhandled URL: ${url.href}`))
  }

  const api = new AppleApi('mock-token', mockFetch)
  const result = await provisionAppProfile(api)

  assert.equal(result.profileId, 'prof-app-123')
  assert.equal(result.profileContent, existingProfileContent)
  // No POST calls made because bundleId, capability, and valid profile both exist
  assert.ok(!calls.some((c) => c.method === 'POST'))
})

void test('provisionAppProfile enables ASSOCIATED_DOMAINS capability on bundle ID when missing', async () => {
  const existingProfileContent = Buffer.from(
    'mock-valid-profile-content with com.apple.developer.associated-domains entitlement',
  ).toString('base64')
  const futureDate = new Date(Date.now() + 86400000).toISOString()

  const calls: { url: URL; method: string; body?: unknown }[] = []
  const mockFetch: typeof fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input)
    const method = init?.method ?? 'GET'
    const body: unknown =
      typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
    calls.push({ url, method, body })

    if (url.pathname.includes('/bundleIdCapabilities') && method === 'GET') {
      return reply({ data: [] })
    }
    if (url.pathname.includes('/bundleIdCapabilities') && method === 'POST') {
      return reply({
        data: record('bundleIdCapabilities', 'new-cap', {
          capabilityType: 'ASSOCIATED_DOMAINS',
        }),
      })
    }
    if (url.pathname.includes('/v1/bundleIds')) {
      return reply({
        data: [
          record('bundleIds', 'bundle-app', { identifier: APP_BUNDLE_ID }),
        ],
      })
    }
    if (url.pathname.includes('/v1/certificates')) {
      return reply({
        data: [
          record('certificates', 'cert-123', { expirationDate: futureDate }),
        ],
      })
    }
    if (url.pathname.includes('/v1/profiles')) {
      return reply({
        data: [
          record('profiles', 'prof-app-123', {
            name: APP_PROFILE_NAME,
            profileContent: existingProfileContent,
            expirationDate: futureDate,
          }),
        ],
      })
    }
    return Promise.reject(new Error(`Unhandled URL: ${url.href}`))
  }

  const api = new AppleApi('mock-token', mockFetch)
  const result = await provisionAppProfile(api)

  assert.equal(result.profileId, 'prof-app-123')
  assert.ok(
    calls.some(
      (c) =>
        c.method === 'POST' &&
        c.url.pathname.includes('/v1/bundleIdCapabilities'),
    ),
    'Expected POST to enable ASSOCIATED_DOMAINS capability',
  )
})

void test('provisionAppProfile deletes profile lacking associated-domains entitlement and recreates it', async () => {
  const profileWithoutEntitlement = Buffer.from(
    'old-profile-without-associated-domains',
  ).toString('base64')
  const newProfileContent = Buffer.from(
    'new-profile-with-com.apple.developer.associated-domains',
  ).toString('base64')
  const futureDate = new Date(Date.now() + 86400000).toISOString()

  const calls: { url: URL; method: string }[] = []
  const mockFetch: typeof fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input)
    const method = init?.method ?? 'GET'
    calls.push({ url, method })

    if (url.pathname.includes('/bundleIdCapabilities')) {
      return reply({
        data: [
          record('bundleIdCapabilities', 'cap-1', {
            capabilityType: 'ASSOCIATED_DOMAINS',
          }),
        ],
      })
    }
    if (url.pathname.includes('/v1/bundleIds')) {
      return reply({
        data: [
          record('bundleIds', 'bundle-app', { identifier: APP_BUNDLE_ID }),
        ],
      })
    }
    if (url.pathname.includes('/v1/certificates')) {
      return reply({
        data: [
          record('certificates', 'cert-123', { expirationDate: futureDate }),
        ],
      })
    }
    if (
      url.pathname.includes('/v1/profiles/outdated-prof') &&
      method === 'DELETE'
    ) {
      return reply({ data: [] })
    }
    if (url.pathname.includes('/v1/profiles') && method === 'GET') {
      return reply({
        data: [
          record('profiles', 'outdated-prof', {
            name: APP_PROFILE_NAME,
            profileContent: profileWithoutEntitlement,
            expirationDate: futureDate,
          }),
        ],
      })
    }
    if (url.pathname.includes('/v1/profiles') && method === 'POST') {
      return reply({
        data: record('profiles', 'fresh-prof', {
          name: APP_PROFILE_NAME,
          profileContent: newProfileContent,
          expirationDate: futureDate,
        }),
      })
    }
    return Promise.reject(new Error(`Unhandled URL: ${url.href}`))
  }

  const api = new AppleApi('mock-token', mockFetch)
  const result = await provisionAppProfile(api)

  assert.equal(result.profileId, 'fresh-prof')
  assert.equal(result.profileContent, newProfileContent)
  assert.ok(
    calls.some(
      (c) =>
        c.method === 'DELETE' &&
        c.url.pathname.includes('/v1/profiles/outdated-prof'),
    ),
    'Expected deletion of profile lacking associated-domains entitlement',
  )
})

void test('provisionAppProfile deletes expired profile and recreates fresh profile', async () => {
  const expiredProfileContent = Buffer.from(
    'old-expired-profile-content with com.apple.developer.associated-domains',
  ).toString('base64')
  const newProfileContent = Buffer.from(
    'new-profile-content with com.apple.developer.associated-domains',
  ).toString('base64')
  const pastDate = new Date(Date.now() - 86400000).toISOString()
  const futureDate = new Date(Date.now() + 86400000).toISOString()

  const calls: { url: URL; method: string; body?: unknown }[] = []
  const mockFetch: typeof fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input)
    const method = init?.method ?? 'GET'
    const body: unknown =
      typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
    calls.push({ url, method, body })

    if (url.pathname.includes('/bundleIdCapabilities')) {
      return reply({
        data: [
          record('bundleIdCapabilities', 'cap-1', {
            capabilityType: 'ASSOCIATED_DOMAINS',
          }),
        ],
      })
    }
    if (url.pathname.includes('/v1/bundleIds')) {
      return reply({
        data: [
          record('bundleIds', 'bundle-app', { identifier: APP_BUNDLE_ID }),
        ],
      })
    }
    if (url.pathname.includes('/v1/certificates')) {
      return reply({
        data: [
          record('certificates', 'cert-123', { expirationDate: futureDate }),
        ],
      })
    }
    if (url.pathname.includes('/v1/profiles/old-prof') && method === 'DELETE') {
      return reply({ data: [] })
    }
    if (url.pathname.includes('/v1/profiles') && method === 'GET') {
      return reply({
        data: [
          record('profiles', 'old-prof', {
            name: APP_PROFILE_NAME,
            profileContent: expiredProfileContent,
            expirationDate: pastDate,
          }),
        ],
      })
    }
    if (url.pathname.includes('/v1/profiles') && method === 'POST') {
      return reply({
        data: record('profiles', 'new-prof', {
          name: APP_PROFILE_NAME,
          profileContent: newProfileContent,
          expirationDate: futureDate,
        }),
      })
    }
    return Promise.reject(new Error(`Unhandled URL: ${url.href}`))
  }

  const api = new AppleApi('mock-token', mockFetch)
  const result = await provisionAppProfile(api)

  assert.equal(result.profileId, 'new-prof')
  assert.equal(result.profileContent, newProfileContent)

  // Verify old profile was deleted
  assert.ok(
    calls.some(
      (c) =>
        c.method === 'DELETE' &&
        c.url.pathname.includes('/v1/profiles/old-prof'),
    ),
    'Expected old profile deletion',
  )

  // Verify new profile was created
  assert.ok(
    calls.some(
      (c) => c.method === 'POST' && c.url.pathname.endsWith('/v1/profiles'),
    ),
    'Expected new profile POST',
  )
})

void test('provisionAppProfile throws if no active distribution certificate exists', async () => {
  const expiredDate = new Date(Date.now() - 86400000).toISOString()
  const mockFetch: typeof fetch = (input) => {
    const url = new URL(input instanceof Request ? input.url : input)
    if (url.pathname.includes('/bundleIdCapabilities')) {
      return reply({
        data: [
          record('bundleIdCapabilities', 'cap-1', {
            capabilityType: 'ASSOCIATED_DOMAINS',
          }),
        ],
      })
    }
    if (url.pathname.includes('/v1/bundleIds')) {
      return reply({
        data: [
          record('bundleIds', 'bundle-app', { identifier: APP_BUNDLE_ID }),
        ],
      })
    }
    if (url.pathname.includes('/v1/certificates')) {
      return reply({
        data: [
          record('certificates', 'cert-expired', {
            expirationDate: expiredDate,
          }),
        ],
      })
    }
    return Promise.reject(new Error(`Unhandled URL: ${url.href}`))
  }

  const api = new AppleApi('mock-token', mockFetch)
  await assert.rejects(
    () => provisionAppProfile(api),
    /No active distribution certificate found in Apple account/,
  )
})
