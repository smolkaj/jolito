import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AppleApi } from '../../scripts/app-store.ts'
import {
  provisionWidgetProfile,
  WIDGET_BUNDLE_ID,
  WIDGET_PROFILE_NAME,
} from '../../scripts/provision-widget.ts'

function record(type: string, id: string, attributes = {}, relationships = {}) {
  return { type, id, attributes, relationships }
}
const reply = (body: unknown) => Promise.resolve(Response.json(body))

void test('provisionWidgetProfile reuses existing bundle ID and unexpired profile', async () => {
  const existingProfileContent = Buffer.from('mock-profile-content').toString(
    'base64',
  )
  const futureDate = new Date(Date.now() + 86400000).toISOString()

  const calls: { url: URL; method: string }[] = []
  const mockFetch: typeof fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input)
    const method = init?.method ?? 'GET'
    calls.push({ url, method })

    if (url.pathname.includes('/v1/bundleIds')) {
      return reply({
        data: [
          record('bundleIds', 'bundle-123', { identifier: WIDGET_BUNDLE_ID }),
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
          record('profiles', 'prof-123', {
            name: WIDGET_PROFILE_NAME,
            profileContent: existingProfileContent,
            expirationDate: futureDate,
          }),
        ],
      })
    }
    return Promise.reject(new Error(`Unhandled URL: ${url.href}`))
  }

  const api = new AppleApi('mock-token', mockFetch)
  const result = await provisionWidgetProfile(api)

  assert.equal(result.profileId, 'prof-123')
  assert.equal(result.profileContent, existingProfileContent)
  // Zero POST calls should be made since both bundleId and profile exist
  assert.ok(!calls.some((c) => c.method === 'POST'))
})

void test('provisionWidgetProfile creates bundle ID and profile when missing', async () => {
  const newProfileContent = Buffer.from('new-profile-content').toString(
    'base64',
  )

  const calls: { url: URL; method: string; body?: unknown }[] = []
  const mockFetch: typeof fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input)
    const method = init?.method ?? 'GET'
    const body: unknown =
      typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
    calls.push({ url, method, body })

    if (url.pathname.includes('/v1/bundleIds')) {
      if (method === 'GET') {
        return reply({ data: [] })
      }
      return reply({
        data: record('bundleIds', 'new-bundle-id', {
          identifier: WIDGET_BUNDLE_ID,
        }),
      })
    }
    if (url.pathname.includes('/v1/certificates')) {
      const futureDate = new Date(Date.now() + 86400000).toISOString()
      return reply({
        data: [
          record('certificates', 'cert-999', { expirationDate: futureDate }),
        ],
      })
    }
    if (url.pathname.includes('/v1/profiles')) {
      if (method === 'GET') {
        return reply({ data: [] })
      }
      return reply({
        data: record('profiles', 'new-prof-id', {
          name: WIDGET_PROFILE_NAME,
          profileContent: newProfileContent,
        }),
      })
    }
    return Promise.reject(new Error(`Unhandled URL: ${url.href}`))
  }

  const api = new AppleApi('mock-token', mockFetch)
  const result = await provisionWidgetProfile(api)

  assert.equal(result.profileId, 'new-prof-id')
  assert.equal(result.profileContent, newProfileContent)

  const postBundle = calls.find(
    (c) => c.method === 'POST' && c.url.pathname.includes('/v1/bundleIds'),
  )
  assert.ok(postBundle, 'Expected POST to /v1/bundleIds')

  const postProfile = calls.find(
    (c) => c.method === 'POST' && c.url.pathname.includes('/v1/profiles'),
  )
  assert.ok(postProfile, 'Expected POST to /v1/profiles')
})

void test('provisionWidgetProfile throws if no distribution certificate exists', async () => {
  const mockFetch: typeof fetch = (input) => {
    const url = new URL(input instanceof Request ? input.url : input)
    if (url.pathname.includes('/v1/bundleIds')) {
      return reply({
        data: [
          record('bundleIds', 'bundle-123', { identifier: WIDGET_BUNDLE_ID }),
        ],
      })
    }
    if (url.pathname.includes('/v1/certificates')) {
      return reply({ data: [] })
    }
    return Promise.reject(new Error(`Unhandled URL: ${url.href}`))
  }

  const api = new AppleApi('mock-token', mockFetch)
  await assert.rejects(
    () => provisionWidgetProfile(api),
    /No active distribution certificate found/,
  )
})

void test('provisionWidgetProfile deletes expired profile before creating a new one', async () => {
  const expiredDate = new Date(Date.now() - 86400000).toISOString()
  const futureDate = new Date(Date.now() + 86400000).toISOString()
  const newProfileContent = Buffer.from('recreated-content').toString('base64')

  const calls: { url: URL; method: string }[] = []
  const mockFetch: typeof fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input)
    const method = init?.method ?? 'GET'
    calls.push({ url, method })

    if (url.pathname.includes('/v1/bundleIds')) {
      return reply({
        data: [
          record('bundleIds', 'bundle-123', { identifier: WIDGET_BUNDLE_ID }),
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
      if (method === 'DELETE') {
        return Promise.resolve(new Response(null, { status: 204 }))
      }
      if (method === 'GET') {
        return reply({
          data: [
            record('profiles', 'old-expired-prof', {
              name: WIDGET_PROFILE_NAME,
              profileContent: 'stale-content',
              expirationDate: expiredDate,
            }),
          ],
        })
      }
      return reply({
        data: record('profiles', 'new-created-prof', {
          name: WIDGET_PROFILE_NAME,
          profileContent: newProfileContent,
          expirationDate: futureDate,
        }),
      })
    }
    return Promise.reject(new Error(`Unhandled URL: ${url.href}`))
  }

  const api = new AppleApi('mock-token', mockFetch)
  const result = await provisionWidgetProfile(api)

  assert.equal(result.profileId, 'new-created-prof')
  assert.equal(result.profileContent, newProfileContent)

  const deleteCall = calls.find(
    (c) =>
      c.method === 'DELETE' &&
      c.url.pathname.includes('/v1/profiles/old-expired-prof'),
  )
  assert.ok(deleteCall, 'Expected DELETE call for expired profile')

  const postProfile = calls.find(
    (c) => c.method === 'POST' && c.url.pathname.includes('/v1/profiles'),
  )
  assert.ok(postProfile, 'Expected POST call to create fresh profile')
})
