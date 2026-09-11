import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  AppleApi,
  configureStore,
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
  } = {},
) {
  const calls: { url: URL; method: string; body?: string }[] = []
  const request: typeof fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input)
    calls.push({
      url,
      method: init?.method ?? 'GET',
      ...(typeof init?.body === 'string' ? { body: init.body } : {}),
    })
    if (init?.method === 'POST')
      return reply({ data: record('result', 'saved') })
    const responses: Record<string, unknown> = {
      '/v1/apps': [record('apps', 'app')],
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
})

void test('apply configures a single US base price, leaves exchange prices to Apple, and verifies the result', async () => {
  const { api, calls } = store()
  await configureStore(api, true)
  const writes = calls.filter((c) => c.method === 'POST')
  assert.equal(writes.length, 2)
  assert.deepEqual(JSON.parse(writes[0]!.body!), priceSchedule('app', 'paid'))
  assert.equal(writes[1]!.url.pathname, '/v2/appAvailabilities')
  assert.equal(calls[calls.length - 1]!.method, 'GET')
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
