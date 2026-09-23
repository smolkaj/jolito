import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  AppleApi,
  checkStatus,
  configureStore,
  CONTENT_RIGHTS_DECLARATION,
  priceSchedule,
} from '../../scripts/app-store.ts'

function record(type: string, id: string, attributes = {}, relationships = {}) {
  return { type, id, attributes, relationships }
}
const reply = (body: unknown) => Promise.resolve(Response.json(body))
const rel = (type: string, id: string) => ({ data: { type, id } })

function store(
  options: {
    wrongPrice?: boolean
    unavailable?: boolean
    expiringPrice?: boolean
    missingContentRights?: boolean
    conflictAvailability?: boolean
    conflictPriceSchedule?: boolean
    emptyVersions?: boolean
    buildMissing?: boolean
    appMissing?: boolean
  } = {},
) {
  let patchedContentRights = false
  const calls: { url: URL; method: string; body?: string }[] = []
  const request: typeof fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input)
    calls.push({
      url,
      method: init?.method ?? 'GET',
      ...(typeof init?.body === 'string' ? { body: init.body } : {}),
    })
    if (init?.method === 'POST') {
      if (
        options.conflictPriceSchedule &&
        url.pathname === '/v1/appPriceSchedules'
      ) {
        return Promise.resolve(new Response('Conflict', { status: 409 }))
      }
      if (
        options.conflictAvailability &&
        url.pathname === '/v2/appAvailabilities'
      ) {
        return Promise.resolve(new Response('Conflict', { status: 409 }))
      }
      return reply({ data: record('result', 'saved') })
    }
    if (init?.method === 'PATCH') {
      patchedContentRights = true
      return reply({
        data: record('apps', 'app', {
          contentRightsDeclaration: CONTENT_RIGHTS_DECLARATION,
        }),
      })
    }
    const fields = url.searchParams.get('fields[apps]')?.split(',') ?? []
    const requestedRights = fields.includes('contentRightsDeclaration')
    const rightsValue =
      requestedRights &&
      !(options.missingContentRights && !patchedContentRights)
        ? CONTENT_RIGHTS_DECLARATION
        : undefined
    const responses: Record<string, unknown> = {
      '/v1/apps': options.appMissing
        ? []
        : [
            record('apps', 'app', {
              name: 'Jolito',
              contentRightsDeclaration: rightsValue,
            }),
          ],
      '/v1/apps/app': record('apps', 'app', {
        name: 'Jolito',
        contentRightsDeclaration: rightsValue,
      }),
      '/v1/apps/app/appStoreVersions': options.emptyVersions
        ? []
        : [
            record(
              'appStoreVersions',
              'v1',
              {
                versionString: '1.0',
                appStoreState: 'WAITING_FOR_REVIEW',
              },
              options.buildMissing ? {} : { build: rel('builds', 'b4') },
            ),
          ],
      '/v1/territories': [
        record('territories', 'USA'),
        record('territories', 'MEX'),
      ],
      '/v1/apps/app/appPricePoints': [
        record('appPricePoints', 'paid', { customerPrice: '2.99' }),
      ],
      '/v1/apps/app/appPriceSchedule': record('appPriceSchedules', 'schedule'),
      '/v1/appPriceSchedules/schedule/baseTerritory': record(
        'territories',
        'USA',
      ),
      '/v1/appPriceSchedules/schedule/manualPrices': [
        record(
          'appPrices',
          'price',
          {
            startDate: null,
            endDate: options.expiringPrice ? '2099-01-01' : null,
          },
          {
            appPricePoint: rel(
              'appPricePoints',
              options.wrongPrice ? 'free' : 'paid',
            ),
          },
        ),
      ],
      '/v1/apps/app/appAvailabilityV2': record(
        'appAvailabilities',
        'availability',
        { availableInNewTerritories: true },
      ),
      '/v2/appAvailabilities/availability/territoryAvailabilities': [
        'USA',
        'MEX',
      ].map((id) =>
        record(
          'territoryAvailabilities',
          id,
          { available: !(options.unavailable && id === 'MEX') },
          { territory: rel('territories', id) },
        ),
      ),
    }
    assert.ok(url.pathname in responses, `Unexpected request: ${url}`)
    if (
      url.pathname === '/v1/apps/app/appStoreVersions' &&
      !options.buildMissing
    ) {
      return reply({
        data: responses[url.pathname],
        included: [record('builds', 'b4', { version: '4' })],
      })
    }
    return reply({ data: responses[url.pathname] })
  }
  return { api: new AppleApi('test-token', request), calls }
}

void test('check is read-only and checks both the paid base price and all territories', async () => {
  const { api, calls } = store()
  await configureStore(api, false)
  assert.ok(calls.every((c) => c.method === 'GET'))
  await assert.rejects(
    configureStore(store({ wrongPrice: true }).api, false),
    /US\$2.99/,
  )
  await assert.rejects(
    configureStore(store({ expiringPrice: true }).api, false),
    /US\$2.99/,
  )
  await assert.rejects(
    configureStore(store({ unavailable: true }).api, false),
    /MEX/,
  )
  await assert.rejects(
    configureStore(store({ missingContentRights: true }).api, false),
    /Content rights/,
  )
})

void test('apply configures a single US base price, leaves exchange prices to Apple, and verifies the result', async () => {
  const { api, calls } = store()
  await configureStore(api, true)
  const writes = calls.filter((c) => c.method === 'POST')
  assert.equal(writes.length, 2)
  assert.deepEqual(JSON.parse(writes[0]!.body!), priceSchedule('app', 'paid'))
  assert.equal(writes[1]!.url.pathname, '/v2/appAvailabilities')
  assert.equal(calls[calls.length - 1]!.method, 'GET')
  const patch = calls.find((c) => c.method === 'PATCH')
  assert.equal(patch, undefined, 'Did not expect PATCH when already configured')
})

void test('apply succeeds idempotently when app availability already exists (HTTP 409 Conflict)', async () => {
  const { api, calls } = store({ conflictAvailability: true })
  await configureStore(api, true)
  const writes = calls.filter((c) => c.method === 'POST')
  assert.equal(writes.length, 2)
  assert.equal(writes[1]!.url.pathname, '/v2/appAvailabilities')
  assert.equal(calls[calls.length - 1]!.method, 'GET')
})

void test('apply succeeds idempotently when price schedule already exists (HTTP 409 Conflict)', async () => {
  const { api, calls } = store({ conflictPriceSchedule: true })
  await configureStore(api, true)
  const writes = calls.filter((c) => c.method === 'POST')
  assert.equal(writes.length, 2)
  assert.equal(writes[0]!.url.pathname, '/v1/appPriceSchedules')
  assert.equal(calls[calls.length - 1]!.method, 'GET')
})

void test('apply patches contentRightsDeclaration when missing', async () => {
  const { api, calls } = store({ missingContentRights: true })
  await configureStore(api, true)
  const patch = calls.find((c) => c.method === 'PATCH')
  assert.ok(patch, 'Expected PATCH to be called')
  assert.equal(patch.url.pathname, '/v1/apps/app')
  assert.deepEqual(JSON.parse(patch.body!), {
    data: {
      type: 'apps',
      id: 'app',
      attributes: {
        contentRightsDeclaration: CONTENT_RIGHTS_DECLARATION,
      },
    },
  })
})

void test('pagination follows all pages without leaking credentials to another origin', async () => {
  let requests = 0
  const api = new AppleApi('private-token', () => {
    requests++
    return reply({
      data: [record('territories', requests === 1 ? 'USA' : 'MEX')],
      links: {
        next:
          requests === 1 ? 'https://api.appstoreconnect.apple.com/page2' : null,
      },
    })
  })
  assert.deepEqual(
    (await api.list('/page1')).map((t) => t.id),
    ['USA', 'MEX'],
  )
  await assert.rejects(
    api.call('https://example.com/steal'),
    /Unexpected Apple API URL/,
  )
  assert.equal(requests, 2)
})

void test('invalid responses, cycles, and HTTP failures stop with no silent success', async () => {
  const invalid = new AppleApi('token', () => reply({ data: [{}] }))
  await assert.rejects(invalid.list('/page'))
  const cyclic = new AppleApi('token', () =>
    reply({ data: [], links: { next: '/page' } }),
  )
  await assert.rejects(cyclic.list('/page'), /pagination cycle/)
  const unauthorized = new AppleApi('token', () =>
    Promise.resolve(new Response('sensitive server body', { status: 401 })),
  )
  await assert.rejects(unauthorized.call('/page'), {
    message: 'Apple API GET /page: HTTP 401',
  })
})

void test('checkStatus resolves and prints current App Store version states with build numbers', async () => {
  const { api, calls } = store()
  const status = await checkStatus(api)
  assert.equal(status.appId, 'app')
  assert.equal(status.bundleId, 'to.joli.app')
  assert.equal(status.name, 'Jolito')
  assert.equal(status.versions.length, 1)
  assert.deepEqual(status.versions[0], {
    versionString: '1.0',
    state: 'WAITING_FOR_REVIEW',
    buildNumber: '4',
  })
  assert.ok(calls.every((c) => c.method === 'GET'))
})

void test('checkStatus handles apps with empty versions or missing build attachments', async () => {
  const empty = await checkStatus(store({ emptyVersions: true }).api)
  assert.equal(empty.versions.length, 0)

  const noBuild = await checkStatus(store({ buildMissing: true }).api)
  assert.equal(noBuild.versions.length, 1)
  assert.equal(noBuild.versions[0]?.buildNumber, undefined)
  assert.equal(noBuild.versions[0]?.state, 'WAITING_FOR_REVIEW')

  await assert.rejects(
    checkStatus(store({ appMissing: true }).api),
    /Create the Jolito app record/,
  )
})
