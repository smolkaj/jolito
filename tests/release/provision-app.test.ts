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

void test('provisionAppProfile reuses existing bundle ID and profile when capability and expiration match', async () => {
  const existingProfileContent = Buffer.from(
    'mock-profile-content-with-com.apple.developer.applesignin-entitlement',
  ).toString('base64')
  const futureDate = new Date(Date.now() + 86400000).toISOString()

  const calls: { url: URL; method: string }[] = []
  const mockFetch: typeof fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input)
    const method = init?.method ?? 'GET'
    calls.push({ url, method })

    if (
      url.pathname.includes('/v1/bundleIds/bundle-app/bundleIdCapabilities')
    ) {
      return reply({
        data: [
          record('bundleIdCapabilities', 'cap-1', {
            capabilityType: 'APPLE_ID_AUTH',
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
  // No POST calls made because bundleId, capability, and valid profile all exist
  assert.ok(!calls.some((c) => c.method === 'POST'))
})

void test('provisionAppProfile registers capability and recreates profile when missing applesignin entitlement', async () => {
  const oldProfileWithoutSignIn = Buffer.from(
    'old-profile-content-without-signin',
  ).toString('base64')
  const newProfileWithSignIn = Buffer.from(
    'new-profile-with-com.apple.developer.applesignin',
  ).toString('base64')
  const futureDate = new Date(Date.now() + 86400000).toISOString()

  const calls: { url: URL; method: string; body?: unknown }[] = []
  const mockFetch: typeof fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input)
    const method = init?.method ?? 'GET'
    const body: unknown =
      typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
    calls.push({ url, method, body })

    if (
      url.pathname.includes('/v1/bundleIds/bundle-app/bundleIdCapabilities')
    ) {
      return reply({
        data: [], // Capability not yet registered
      })
    }
    if (
      url.pathname.endsWith('/v1/bundleIdCapabilities') &&
      method === 'POST'
    ) {
      return reply({
        data: record('bundleIdCapabilities', 'cap-new', {
          capabilityType: 'APPLE_ID_AUTH',
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
    if (url.pathname.includes('/v1/profiles/old-prof') && method === 'DELETE') {
      return reply({ data: [] })
    }
    if (url.pathname.includes('/v1/profiles') && method === 'GET') {
      return reply({
        data: [
          record('profiles', 'old-prof', {
            name: APP_PROFILE_NAME,
            profileContent: oldProfileWithoutSignIn,
            expirationDate: futureDate,
          }),
        ],
      })
    }
    if (url.pathname.includes('/v1/profiles') && method === 'POST') {
      return reply({
        data: record('profiles', 'new-prof', {
          name: APP_PROFILE_NAME,
          profileContent: newProfileWithSignIn,
          expirationDate: futureDate,
        }),
      })
    }
    return Promise.reject(new Error(`Unhandled URL: ${url.href}`))
  }

  const api = new AppleApi('mock-token', mockFetch)
  const result = await provisionAppProfile(api)

  assert.equal(result.profileId, 'new-prof')
  assert.equal(result.profileContent, newProfileWithSignIn)

  // Verify capability POST was executed
  const capPost = calls.find(
    (c) =>
      c.method === 'POST' &&
      c.url.pathname.endsWith('/v1/bundleIdCapabilities'),
  )
  assert.ok(capPost, 'Expected bundleIdCapabilities POST')
  assert.equal(
    (capPost?.body as { data: { attributes: { capabilityType: string } } })
      ?.data.attributes.capabilityType,
    'APPLE_ID_AUTH',
  )

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
    if (
      url.pathname.includes('/v1/bundleIds/bundle-app/bundleIdCapabilities')
    ) {
      return reply({
        data: [
          record('bundleIdCapabilities', 'cap-1', {
            capabilityType: 'SIGN_IN_WITH_APPLE',
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
