import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  AppleApi,
  checkStatus,
  configureStore,
  CONTENT_RIGHTS_DECLARATION,
  priceSchedule,
  submitAppStoreVersion,
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
    versionState?: string
    versionBuildNumber?: string
    builds?: { id: string; version: string }[]
    reviewSubmissions?: { id: string; state: string }[]
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
      if (url.pathname === '/v1/reviewSubmissions') {
        return reply({
          data: record('reviewSubmissions', 'sub-new', {
            state: 'READY_FOR_REVIEW',
          }),
        })
      }
      if (url.pathname === '/v1/reviewSubmissionItems') {
        return reply({ data: record('reviewSubmissionItems', 'item-new') })
      }
      return reply({ data: record('result', 'saved') })
    }
    if (init?.method === 'PATCH') {
      if (url.pathname.startsWith('/v1/reviewSubmissions/')) {
        const bodyObj =
          typeof init?.body === 'string'
            ? (JSON.parse(init.body) as {
                data?: { attributes?: { canceled?: boolean } }
              })
            : {}
        const isCanceled = bodyObj.data?.attributes?.canceled
        return reply({
          data: record('reviewSubmissions', url.pathname.split('/').pop()!, {
            state: isCanceled ? 'COMPLETE' : 'WAITING_FOR_REVIEW',
          }),
        })
      }
      if (url.pathname.startsWith('/v1/appStoreVersions/')) {
        return reply({
          data: record('appStoreVersions', url.pathname.split('/').pop()!, {
            versionString: '1.0',
          }),
        })
      }
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
    const versionState = options.versionState ?? 'WAITING_FOR_REVIEW'
    const buildId = options.versionBuildNumber
      ? `b${options.versionBuildNumber}`
      : 'b4'
    const buildVer = options.versionBuildNumber ?? '4'
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
                appStoreState: versionState,
              },
              options.buildMissing ? {} : { build: rel('builds', buildId) },
            ),
          ],
      '/v1/apps/app/reviewSubmissions':
        options.reviewSubmissions?.map((s) =>
          record('reviewSubmissions', s.id, { state: s.state }),
        ) ?? [],
      '/v1/builds': (
        options.builds ?? [
          { id: 'b4', version: '4' },
          { id: 'b10', version: '10' },
        ]
      )
        .filter((b) => {
          const filterVer = url.searchParams.get('filter[version]')
          return !filterVer || b.version === filterVer
        })
        .map((b) => record('builds', b.id, { version: b.version })),
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
        included: [record('builds', buildId, { version: buildVer })],
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

void test('checkStatus includes review submissions when present', async () => {
  const status = await checkStatus(
    store({
      reviewSubmissions: [
        { id: 'sub-1', state: 'COMPLETE' },
        { id: 'sub-2', state: 'WAITING_FOR_REVIEW' },
      ],
    }).api,
  )
  assert.equal(status.reviewSubmissions.length, 2)
  assert.deepEqual(status.reviewSubmissions, [
    { id: 'sub-1', state: 'COMPLETE' },
    { id: 'sub-2', state: 'WAITING_FOR_REVIEW' },
  ])
})

void test('submitAppStoreVersion attaches build if needed, cancels stuck submissions, creates new submission, and submits', async () => {
  const { api, calls } = store({
    versionState: 'PREPARE_FOR_SUBMISSION',
    versionBuildNumber: '9',
    reviewSubmissions: [
      { id: 'sub-stuck', state: 'UNRESOLVED_ISSUES' },
      { id: 'sub-old', state: 'COMPLETE' },
    ],
  })

  await submitAppStoreVersion(api, '10')

  // Verify build was attached via PATCH
  const patchBuild = calls.find(
    (c) => c.method === 'PATCH' && c.url.pathname === '/v1/appStoreVersions/v1',
  )
  assert.ok(
    patchBuild,
    'Expected PATCH /v1/appStoreVersions/v1 to attach build',
  )
  assert.deepEqual(JSON.parse(patchBuild.body!), {
    data: {
      type: 'appStoreVersions',
      id: 'v1',
      relationships: {
        build: { data: { type: 'builds', id: 'b10' } },
      },
    },
  })

  // Verify stuck submission was canceled
  const patchCancel = calls.find(
    (c) =>
      c.method === 'PATCH' &&
      c.url.pathname === '/v1/reviewSubmissions/sub-stuck',
  )
  assert.ok(patchCancel, 'Expected PATCH to cancel stuck submission')
  assert.deepEqual(JSON.parse(patchCancel.body!), {
    data: {
      type: 'reviewSubmissions',
      id: 'sub-stuck',
      attributes: { canceled: true },
    },
  })

  // Verify new review submission created
  const postSub = calls.find(
    (c) => c.method === 'POST' && c.url.pathname === '/v1/reviewSubmissions',
  )
  assert.ok(postSub, 'Expected POST /v1/reviewSubmissions')

  // Verify item added
  const postItem = calls.find(
    (c) =>
      c.method === 'POST' && c.url.pathname === '/v1/reviewSubmissionItems',
  )
  assert.ok(postItem, 'Expected POST /v1/reviewSubmissionItems')

  // Verify submission submitted
  const patchSubmit = calls.find(
    (c) =>
      c.method === 'PATCH' &&
      c.url.pathname === '/v1/reviewSubmissions/sub-new',
  )
  assert.ok(patchSubmit, 'Expected PATCH /v1/reviewSubmissions/sub-new')
  assert.deepEqual(JSON.parse(patchSubmit.body!), {
    data: {
      type: 'reviewSubmissions',
      id: 'sub-new',
      attributes: { submitted: true },
    },
  })
})

void test('submitAppStoreVersion is a no-op when version is already in WAITING_FOR_REVIEW', async () => {
  const { api, calls } = store({
    versionState: 'WAITING_FOR_REVIEW',
  })
  await submitAppStoreVersion(api, '10')
  assert.ok(!calls.some((c) => c.method === 'POST'))
})

void test('submitAppStoreVersion rejects when version is missing or target build is not found', async () => {
  await assert.rejects(
    submitAppStoreVersion(store({ emptyVersions: true }).api, '10'),
    /App Store version 1\.0 not found/,
  )

  await assert.rejects(
    submitAppStoreVersion(
      store({
        versionState: 'PREPARE_FOR_SUBMISSION',
        builds: [],
      }).api,
      '999',
    ),
    /Build 999 not found/,
  )
})

void test('review notes exist and do not exceed App Store Connect 4000 character limit', () => {
  const notesPath = path.resolve(
    'fastlane/metadata/review_information/notes.txt',
  )
  assert.ok(fs.existsSync(notesPath), 'Review notes file must exist')
  const content = fs.readFileSync(notesPath, 'utf8')
  assert.ok(content.length > 0, 'Review notes must not be empty')
  assert.ok(
    content.length <= 4000,
    `Review notes cannot exceed 4000 characters (found ${content.length})`,
  )
})
