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
  validateBuildNumber,
  withdrawForReplacement,
  verifyReviewInformation,
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
    attachedVersion?: string
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
      if (url.pathname.startsWith('/v1/builds/')) {
        return reply({
          data: record('builds', url.pathname.split('/').pop()!, {
            usesNonExemptEncryption: false,
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
    if (url.pathname.match(/^\/v1\/reviewSubmissions\/[^/]+\/items$/)) {
      return reply({
        data: options.attachedVersion
          ? [
              record(
                'reviewSubmissionItems',
                'attached',
                {},
                {
                  appStoreVersion:
                    url.searchParams.get('include') === 'appStoreVersion'
                      ? rel('appStoreVersions', options.attachedVersion)
                      : {
                          links: {
                            related:
                              'https://api.appstoreconnect.apple.com/v1/reviewSubmissionItems/attached/appStoreVersion',
                          },
                        },
                },
              ),
            ]
          : [],
      })
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

void test('apply declares licensed third-party dictionary content when missing', async () => {
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
        contentRightsDeclaration: 'USES_THIRD_PARTY_CONTENT',
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

void test('validateBuildNumber accepts valid build numbers and rejects invalid ones', () => {
  assert.equal(validateBuildNumber('1'), '1')
  assert.equal(validateBuildNumber('10'), '10')
  assert.equal(validateBuildNumber('9999'), '9999')
  assert.equal(validateBuildNumber('  42  '), '42')

  assert.throws(
    () => validateBuildNumber(''),
    /Specify the exact tested build number/,
  )
  assert.throws(
    () => validateBuildNumber('   '),
    /Specify the exact tested build number/,
  )
  assert.throws(
    () => validateBuildNumber(undefined),
    /Specify the exact tested build number/,
  )
  assert.throws(
    () => validateBuildNumber('0'),
    /Specify the exact tested build number/,
  )
  assert.throws(
    () => validateBuildNumber('10000'),
    /Specify the exact tested build number/,
  )
  assert.throws(
    () => validateBuildNumber('abc'),
    /Specify the exact tested build number/,
  )
})

void test('submitAppStoreVersion attaches build if needed, cancels UNRESOLVED_ISSUES submissions, creates new submission, and submits', async () => {
  const { api, calls } = store({
    versionState: 'PREPARE_FOR_SUBMISSION',
    versionBuildNumber: '9',
    reviewSubmissions: [
      { id: 'sub-stuck', state: 'UNRESOLVED_ISSUES' },
      { id: 'sub-old', state: 'COMPLETE' },
    ],
  })

  await submitAppStoreVersion(api, '10')

  // Verify export compliance was configured on target build
  const patchEncryption = calls.find(
    (c) => c.method === 'PATCH' && c.url.pathname === '/v1/builds/b10',
  )
  assert.ok(
    patchEncryption,
    'Expected PATCH /v1/builds/b10 to set usesNonExemptEncryption',
  )
  assert.deepEqual(JSON.parse(patchEncryption.body!), {
    data: {
      type: 'builds',
      id: 'b10',
      attributes: { usesNonExemptEncryption: false },
    },
  })

  // Verify build was attached and releaseType configured via PATCH
  const patchBuild = calls.find(
    (c) => c.method === 'PATCH' && c.url.pathname === '/v1/appStoreVersions/v1',
  )
  assert.ok(
    patchBuild,
    'Expected PATCH /v1/appStoreVersions/v1 to attach build and configure releaseType',
  )
  assert.deepEqual(JSON.parse(patchBuild.body!), {
    data: {
      type: 'appStoreVersions',
      id: 'v1',
      attributes: {
        releaseType: 'AFTER_APPROVAL',
      },
      relationships: {
        build: { data: { type: 'builds', id: 'b10' } },
      },
    },
  })

  // Verify stuck submission was canceled
  const patchCancelStuck = calls.find(
    (c) =>
      c.method === 'PATCH' &&
      c.url.pathname === '/v1/reviewSubmissions/sub-stuck',
  )
  assert.ok(
    patchCancelStuck,
    'Expected PATCH to cancel UNRESOLVED_ISSUES submission',
  )
  assert.deepEqual(JSON.parse(patchCancelStuck.body!), {
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

void test('submitAppStoreVersion reuses existing READY_FOR_REVIEW submission without creating a new one', async () => {
  const { api, calls } = store({
    versionState: 'PREPARE_FOR_SUBMISSION',
    versionBuildNumber: '10',
    reviewSubmissions: [{ id: 'sub-ready', state: 'READY_FOR_REVIEW' }],
  })

  await submitAppStoreVersion(api, '10')

  // Verify READY_FOR_REVIEW was NOT canceled
  assert.ok(
    !calls.some(
      (c) =>
        c.method === 'PATCH' &&
        c.url.pathname === '/v1/reviewSubmissions/sub-ready' &&
        c.body?.includes('"canceled":true'),
    ),
    'READY_FOR_REVIEW must not be canceled',
  )

  // Verify no new review submission created
  assert.ok(
    !calls.some(
      (c) => c.method === 'POST' && c.url.pathname === '/v1/reviewSubmissions',
    ),
    'Must not POST /v1/reviewSubmissions when READY_FOR_REVIEW exists',
  )

  // Verify item attached to existing sub-ready
  const postItem = calls.find(
    (c) =>
      c.method === 'POST' && c.url.pathname === '/v1/reviewSubmissionItems',
  )
  assert.ok(postItem, 'Expected POST /v1/reviewSubmissionItems')
  assert.deepEqual(JSON.parse(postItem.body!), {
    data: {
      type: 'reviewSubmissionItems',
      relationships: {
        reviewSubmission: {
          data: { type: 'reviewSubmissions', id: 'sub-ready' },
        },
        appStoreVersion: { data: { type: 'appStoreVersions', id: 'v1' } },
      },
    },
  })

  // Verify sub-ready submitted
  const patchSubmit = calls.find(
    (c) =>
      c.method === 'PATCH' &&
      c.url.pathname === '/v1/reviewSubmissions/sub-ready',
  )
  assert.ok(patchSubmit, 'Expected PATCH /v1/reviewSubmissions/sub-ready')
  assert.deepEqual(JSON.parse(patchSubmit.body!), {
    data: {
      type: 'reviewSubmissions',
      id: 'sub-ready',
      attributes: { submitted: true },
    },
  })
})

void test('submitAppStoreVersion is a no-op when the requested build is already queued', async () => {
  const { api, calls } = store({
    versionState: 'WAITING_FOR_REVIEW',
    versionBuildNumber: '10',
  })
  await submitAppStoreVersion(api, '10')
  assert.ok(!calls.some((c) => c.method === 'POST'))
})

void test('resuming a draft requests relationship linkage and preserves its existing version item', async () => {
  const { api, calls } = store({
    versionState: 'DEVELOPER_REJECTED',
    versionBuildNumber: '10',
    reviewSubmissions: [{ id: 'sub-ready', state: 'READY_FOR_REVIEW' }],
    attachedVersion: 'v1',
  })
  await submitAppStoreVersion(api, '10')
  assert.ok(!calls.some((c) => c.method === 'POST'))
  assert.ok(
    calls.some(
      (c) => c.method === 'PATCH' && c.body?.includes('"submitted":true'),
    ),
  )
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

  await assert.rejects(
    submitAppStoreVersion(store().api, ''),
    /Specify the exact tested build number/,
  )

  await assert.rejects(
    submitAppStoreVersion(store().api, 'invalid'),
    /Specify the exact tested build number/,
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

void test('replacement waits for cancellation and preserves unrelated submissions', async () => {
  for (const scenario of ['complete', 'missing-linkage', 'mixed-items']) {
    let state = 'WAITING_FOR_REVIEW'
    let polls = 0
    const writes: string[] = []
    const api = new AppleApi('token', (input, init) => {
      const url = new URL(input instanceof Request ? input.url : input)
      if (init?.method === 'PATCH') {
        writes.push(url.pathname)
        state = 'CANCELING'
        return reply({
          data: record('reviewSubmissions', 'current', { state }),
        })
      }
      if (url.pathname === '/v1/apps')
        return reply({ data: [record('apps', 'app')] })
      if (url.pathname === '/v1/apps/app/appStoreVersions')
        return reply({
          data: [
            record(
              'appStoreVersions',
              'v1',
              { versionString: '1.0', appStoreState: 'WAITING_FOR_REVIEW' },
              { build: rel('builds', 'old') },
            ),
          ],
          included: [record('builds', 'old', { version: '10' })],
        })
      if (url.pathname === '/v1/builds')
        return reply({
          data: [
            record(
              'builds',
              'new',
              { version: '11', processingState: 'VALID', expired: false },
              { preReleaseVersion: rel('preReleaseVersions', 'pr') },
            ),
          ],
          included: [
            record('preReleaseVersions', 'pr', {
              version: '1.0',
              platform: 'IOS',
            }),
          ],
        })
      if (url.pathname === '/v1/apps/app/reviewSubmissions')
        return reply({
          data: [
            record('reviewSubmissions', 'unrelated', {
              state: 'WAITING_FOR_REVIEW',
            }),
            record('reviewSubmissions', 'current', { state }),
          ],
        })
      if (url.pathname.endsWith('/items')) {
        const items = [
          record(
            'reviewSubmissionItems',
            'item',
            {},
            {
              appStoreVersion:
                scenario !== 'missing-linkage' &&
                url.searchParams.get('include') === 'appStoreVersion'
                  ? rel(
                      'appStoreVersions',
                      url.pathname.includes('current') ? 'v1' : 'other',
                    )
                  : {
                      links: {
                        related:
                          'https://api.appstoreconnect.apple.com/v1/reviewSubmissionItems/item/appStoreVersion',
                      },
                    },
            },
          ),
        ]
        if (scenario === 'mixed-items' && url.pathname.includes('current')) {
          items.push(
            record(
              'reviewSubmissionItems',
              'event',
              {},
              { appStoreVersion: { data: null } },
            ),
          )
        }
        return reply({ data: items })
      }
      if (url.pathname === '/v1/reviewSubmissions/current') {
        polls++
        if (polls === 2) state = 'COMPLETE'
        return reply({
          data: record('reviewSubmissions', 'current', { state }),
        })
      }
      throw new Error('Unexpected request ' + url.pathname)
    })
    if (scenario === 'complete') {
      await withdrawForReplacement(api, '11', async () => {})
      assert.deepEqual(writes, ['/v1/reviewSubmissions/current'])
      assert.equal(polls, 2)
      assert.equal(state, 'COMPLETE')
    } else {
      await assert.rejects(
        withdrawForReplacement(api, '11', async () => {}),
        scenario === 'missing-linkage'
          ? /could not be matched/
          : /additional items/,
      )
      assert.deepEqual(writes, [])
      assert.equal(polls, 0)
    }
  }
})

void test('submission never silently accepts a different queued build', async () => {
  for (const versionState of ['WAITING_FOR_REVIEW', 'IN_REVIEW']) {
    const { api, calls } = store({ versionState, versionBuildNumber: '10' })
    await assert.rejects(submitAppStoreVersion(api, '11'), /different build/)
    assert.ok(calls.every((call) => call.method === 'GET'))
    await submitAppStoreVersion(api, '10')
    assert.ok(calls.every((call) => call.method === 'GET'))
  }
})

void test('replacement validates candidate version, platform and processing before any withdrawal', async () => {
  for (const attributes of [
    { version: '11', processingState: 'PROCESSING', expired: false },
    { version: '11', processingState: 'VALID', expired: true },
    {
      version: '11',
      processingState: 'VALID',
      expired: false,
      wrongVersion: true,
    },
    {
      version: '11',
      processingState: 'VALID',
      expired: false,
      wrongPlatform: true,
    },
  ]) {
    const writes: string[] = []
    const api = new AppleApi('token', (input, init) => {
      const url = new URL(input instanceof Request ? input.url : input)
      if (init?.method && init.method !== 'GET') writes.push(url.pathname)
      if (url.pathname === '/v1/apps')
        return reply({ data: [record('apps', 'app')] })
      if (url.pathname.endsWith('/appStoreVersions'))
        return reply({
          data: [record('appStoreVersions', 'v1', { versionString: '1.0' })],
        })
      if (url.pathname === '/v1/builds')
        return reply({
          data: [
            record('builds', 'new', attributes, {
              preReleaseVersion: rel('preReleaseVersions', 'pr'),
            }),
          ],
          included: [
            record('preReleaseVersions', 'pr', {
              version: attributes.wrongVersion ? '2.0' : '1.0',
              platform: attributes.wrongPlatform ? 'MAC_OS' : 'IOS',
            }),
          ],
        })
      throw new Error('Candidate validation must precede submission changes')
    })
    await assert.rejects(
      withdrawForReplacement(api, '11', async () => {}),
      /processed, unexpired iOS build/,
    )
    assert.deepEqual(writes, [])
  }
})

void test('review readback validates private access and complete video without mutating Apple', async () => {
  const expected = {
    notes: 'Six-part review notes',
    email: 'review@example.com',
    password: 'private',
    fileSize: 12345,
    checksum: 'expected-md5',
  }
  for (const mismatch of [
    '',
    'notes',
    'demoAccountPassword',
    'attachment',
    'checksum',
  ]) {
    const api = new AppleApi('token', (input, init) => {
      assert.equal(init?.method, 'GET')
      const url = new URL(input instanceof Request ? input.url : input)
      if (url.pathname === '/v1/apps')
        return reply({ data: [record('apps', 'app')] })
      if (url.pathname.endsWith('/appStoreVersions'))
        return reply({
          data: [record('appStoreVersions', 'v1', { versionString: '1.0' })],
        })
      const attributes = {
        notes: expected.notes,
        demoAccountRequired: true,
        demoAccountName: expected.email,
        demoAccountPassword: expected.password,
        ...(mismatch ? { [mismatch]: 'different' } : {}),
      }
      return reply({
        data: record('appStoreReviewDetails', 'detail', attributes),
        included:
          mismatch === 'attachment'
            ? []
            : [
                record('appStoreReviewAttachments', 'video', {
                  fileName: 'native-walkthrough.mp4',
                  fileSize: 12345,
                  sourceFileChecksum:
                    mismatch === 'checksum' ? 'wrong' : 'expected-md5',
                  assetDeliveryState: { state: 'COMPLETE' },
                }),
              ],
      })
    })
    if (mismatch)
      await assert.rejects(
        verifyReviewInformation(api, expected),
        /Stored App Review|video attachment/,
      )
    else await verifyReviewInformation(api, expected)
  }
})

void test('review readback waits for asynchronous video delivery and bounds failed processing', async () => {
  const expected = {
    notes: 'Notes',
    email: 'review@example.com',
    password: 'private',
    fileSize: 10,
    checksum: 'md5',
  }
  for (const outcome of ['COMPLETE', 'FAILED', 'UPLOAD_COMPLETE']) {
    let reads = 0
    let waits = 0
    const api = new AppleApi('token', (input, init) => {
      assert.equal(init?.method, 'GET')
      const url = new URL(input instanceof Request ? input.url : input)
      if (url.pathname === '/v1/apps')
        return reply({ data: [record('apps', 'app')] })
      if (url.pathname.endsWith('/appStoreVersions'))
        return reply({
          data: [record('appStoreVersions', 'v1', { versionString: '1.0' })],
        })
      reads++
      return reply({
        data: record('appStoreReviewDetails', 'detail', {
          notes: expected.notes,
          demoAccountRequired: true,
          demoAccountName: expected.email,
          demoAccountPassword: expected.password,
        }),
        included: [
          record('appStoreReviewAttachments', 'video', {
            fileName: 'native-walkthrough.mp4',
            fileSize: expected.fileSize,
            sourceFileChecksum: expected.checksum,
            assetDeliveryState: {
              state: reads < 3 ? 'UPLOAD_COMPLETE' : outcome,
            },
          }),
        ],
      })
    })
    const verification = verifyReviewInformation(api, expected, () => {
      waits++
      return Promise.resolve()
    })
    if (outcome === 'COMPLETE') await verification
    else await assert.rejects(verification, /video attachment/)
    assert.equal(reads, outcome === 'UPLOAD_COMPLETE' ? 60 : 3)
    assert.equal(waits, reads - 1)
  }
})
