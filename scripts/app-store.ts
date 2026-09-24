import { readFileSync } from 'node:fs'
import { createPrivateKey, sign } from 'node:crypto'
import { z } from 'zod'

const settingsSchema = z.object({
  bundleId: z.literal('to.joli.app'),
  version: z.string().regex(/^\d+\.\d+(\.\d+)?$/),
  baseTerritory: z.literal('USA'),
  price: z.literal('2.99'),
  availableInNewTerritories: z.boolean(),
  excludedTerritories: z.array(z.string().regex(/^[A-Z]{3}$/)),
})
export const settings = settingsSchema.parse(
  JSON.parse(
    readFileSync(new URL('../fastlane/release.json', import.meta.url), 'utf8'),
  ),
)
export const CONTENT_RIGHTS_DECLARATION = 'DOES_NOT_USE_THIRD_PARTY_CONTENT'
const idSchema = z.object({ type: z.string(), id: z.string().min(1) })
const resourceSchema = idSchema.extend({
  attributes: z.record(z.string(), z.unknown()).default({}),
  relationships: z
    .record(z.string(), z.object({ data: z.unknown().optional() }))
    .default({}),
})
const responseSchema = z.object({
  data: z.union([resourceSchema, z.array(resourceSchema)]),
  included: z.array(resourceSchema).default([]),
  links: z.object({ next: z.string().nullable().optional() }).optional(),
})
type Resource = z.infer<typeof resourceSchema>
const origin = 'https://api.appstoreconnect.apple.com'
const relation = (type: string, id: string) => ({ data: { type, id } })
const relatedId = (item: Resource, name: string) =>
  idSchema.parse(item.relationships[name]?.data).id

export class AppleApi {
  private token: string
  private request: typeof fetch
  constructor(token: string, request: typeof fetch = fetch) {
    this.token = token
    this.request = request
  }
  async call(path: string, method = 'GET', body?: unknown) {
    const url = new URL(path, origin)
    if (url.origin !== origin || url.username || url.password)
      throw new Error('Unexpected Apple API URL')
    const response = await this.request(url, {
      method,
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          `Apple API ${method} ${url.pathname}: HTTP ${response.status}`,
        )
      }
      const errorText = await response.text().catch(() => '')
      throw new Error(
        `Apple API ${method} ${url.pathname}: HTTP ${response.status}${errorText ? ` - ${errorText}` : ''}`,
      )
    }
    if (response.status === 204) return { data: [], included: [] }
    return responseSchema.parse(await response.json())
  }
  async list(path: string) {
    const all: Resource[] = []
    const visited = new Set<string>()
    let next: string | null | undefined = path
    while (next) {
      if (visited.has(next)) throw new Error('Apple API pagination cycle')
      visited.add(next)
      const response = await this.call(next)
      all.push(...z.array(resourceSchema).parse(response.data))
      next = response.links?.next
    }
    return all
  }
}

export function priceSchedule(appId: string, pricePoint: string) {
  const priceId = '${jolito-base-price}'
  return {
    data: {
      type: 'appPriceSchedules',
      relationships: {
        app: relation('apps', appId),
        baseTerritory: relation('territories', settings.baseTerritory),
        manualPrices: { data: [{ type: 'appPrices', id: priceId }] },
      },
    },
    included: [
      {
        type: 'appPrices',
        id: priceId,
        attributes: { startDate: null, endDate: null },
        relationships: {
          appPricePoint: relation('appPricePoints', pricePoint),
        },
      },
    ],
  }
}

export async function configureStore(api: AppleApi, apply: boolean) {
  const apps = await api.list(
    `/v1/apps?filter[bundleId]=${settings.bundleId}&fields[apps]=bundleId,contentRightsDeclaration`,
  )
  if (apps.length !== 1)
    throw new Error('Create the Jolito app record in App Store Connect first')
  const app = apps[0]!
  const territories = await api.list('/v1/territories?limit=200')
  for (const excluded of settings.excludedTerritories) {
    if (!territories.some((t) => t.id === excluded))
      throw new Error(`Unknown excluded territory: ${excluded}`)
  }
  const points = await api.list(
    `/v1/apps/${app.id}/appPricePoints?filter[territory]=USA&limit=200`,
  )
  const matching = points.filter(
    (p) => p.attributes.customerPrice === settings.price,
  )
  if (matching.length !== 1)
    throw new Error('Cannot uniquely resolve the US$2.99 price point')
  const point = matching[0]!

  if (apply) {
    if (
      app.attributes.contentRightsDeclaration !== CONTENT_RIGHTS_DECLARATION
    ) {
      await api.call(`/v1/apps/${app.id}`, 'PATCH', {
        data: {
          type: 'apps',
          id: app.id,
          attributes: {
            contentRightsDeclaration: CONTENT_RIGHTS_DECLARATION,
          },
        },
      })
    }
    try {
      await api.call(
        '/v1/appPriceSchedules',
        'POST',
        priceSchedule(app.id, point.id),
      )
    } catch (error) {
      if (!(
        error instanceof Error &&
        error.message.includes('POST /v1/appPriceSchedules: HTTP 409')
      )) {
        throw error
      }
    }
    // Initial availability creation requires POST /v2/appAvailabilities.
    // If availability already exists for this app, Apple returns HTTP 409 Conflict.
    // Eligibility remains Apple's decision; restrictions must be recorded in release.json.
    const included = territories.map((t) => ({
      type: 'territoryAvailabilities',
      id: `\u0024{availability-${t.id}}`,
      attributes: {
        available: !settings.excludedTerritories.includes(t.id),
        preOrderEnabled: false,
      },
      relationships: { territory: relation('territories', t.id) },
    }))
    try {
      await api.call('/v2/appAvailabilities', 'POST', {
        data: {
          type: 'appAvailabilities',
          attributes: {
            availableInNewTerritories: settings.availableInNewTerritories,
          },
          relationships: {
            app: relation('apps', app.id),
            territoryAvailabilities: {
              data: included.map(({ type, id }) => ({ type, id })),
            },
          },
        },
        included,
      })
    } catch (error) {
      if (!(
        error instanceof Error &&
        error.message.includes('POST /v2/appAvailabilities: HTTP 409')
      )) {
        throw error
      }
    }
  }

  const schedule = resourceSchema.parse(
    (await api.call(`/v1/apps/${app.id}/appPriceSchedule`)).data,
  )
  const base = resourceSchema.parse(
    (await api.call(`/v1/appPriceSchedules/${schedule.id}/baseTerritory`)).data,
  )
  if (base.id !== settings.baseTerritory)
    throw new Error('Base territory differs from release.json')
  const prices = await api.list(
    `/v1/appPriceSchedules/${schedule.id}/manualPrices?include=appPricePoint&limit=200`,
  )
  const dateSchema = z.iso.date().nullable().optional()
  const today = new Date().toISOString().slice(0, 10)
  const current = prices.filter((p) => {
    const end = dateSchema.parse(p.attributes.endDate)
    return !end || end > today
  })
  const price = current[0]
  const start = dateSchema.parse(price?.attributes.startDate)
  if (
    current.length !== 1 ||
    !price ||
    relatedId(price, 'appPricePoint') !== point.id ||
    Boolean(dateSchema.parse(price.attributes.endDate)) ||
    (start && start > today)
  ) {
    throw new Error(
      'Expected a current US$2.99 base price with no other manual/future prices',
    )
  }
  const availability = resourceSchema.parse(
    (await api.call(`/v1/apps/${app.id}/appAvailabilityV2`)).data,
  )
  if (
    availability.attributes.availableInNewTerritories !==
    settings.availableInNewTerritories
  )
    throw new Error('New-territory availability differs from release.json')
  const available = await api.list(
    `/v2/appAvailabilities/${availability.id}/territoryAvailabilities?include=territory&limit=200`,
  )
  const mismatches = territories.filter((t) => {
    const entry = available.find((a) => relatedId(a, 'territory') === t.id)
    return (
      entry?.attributes.available !==
      !settings.excludedTerritories.includes(t.id)
    )
  })
  if (mismatches.length)
    throw new Error(
      `Availability differs for: ${mismatches.map((t) => t.id).join(', ')}`,
    )
  const currentApp = resourceSchema.parse(
    (await api.call(`/v1/apps/${app.id}?fields[apps]=contentRightsDeclaration`))
      .data,
  )
  if (
    currentApp.attributes.contentRightsDeclaration !==
    CONTENT_RIGHTS_DECLARATION
  )
    throw new Error(
      `Content rights declaration differs: expected ${CONTENT_RIGHTS_DECLARATION}`,
    )
  console.log(
    'Verified US$2.99 base price, content rights declaration, and configured worldwide availability. Apple eligibility and agreements still apply.',
  )
}

export interface AppStoreVersionSummary {
  versionString: string
  state: string
  buildNumber?: string | undefined
}

export interface ReviewSubmissionSummary {
  id: string
  state: string
}

export interface AppStoreStatus {
  appId: string
  bundleId: string
  name?: string | undefined
  versions: AppStoreVersionSummary[]
  reviewSubmissions: ReviewSubmissionSummary[]
}

export async function checkStatus(api: AppleApi): Promise<AppStoreStatus> {
  const apps = await api.list(
    `/v1/apps?filter[bundleId]=${settings.bundleId}&fields[apps]=bundleId,name`,
  )
  if (apps.length !== 1)
    throw new Error('Create the Jolito app record in App Store Connect first')
  const app = apps[0]!
  const name =
    typeof app.attributes.name === 'string' ? app.attributes.name : undefined

  const response = await api.call(
    `/v1/apps/${app.id}/appStoreVersions?include=build&limit=10`,
  )
  const versionsData = z.array(resourceSchema).parse(response.data)
  const versions: AppStoreVersionSummary[] = versionsData.map((v) => {
    const versionString =
      typeof v.attributes.versionString === 'string'
        ? v.attributes.versionString
        : ''
    const state =
      typeof v.attributes.appStoreState === 'string'
        ? v.attributes.appStoreState
        : 'UNKNOWN'
    const buildRel = idSchema.safeParse(v.relationships.build?.data)
    const buildResource = buildRel.success
      ? response.included.find(
          (r) => r.type === 'builds' && r.id === buildRel.data.id,
        )
      : undefined
    const buildNumber =
      buildResource && typeof buildResource.attributes.version === 'string'
        ? buildResource.attributes.version
        : undefined
    return { versionString, state, buildNumber }
  })

  const submissionsData = await api.list(
    `/v1/apps/${app.id}/reviewSubmissions?limit=10`,
  )
  const reviewSubmissions: ReviewSubmissionSummary[] = submissionsData.map(
    (s) => ({
      id: s.id,
      state:
        typeof s.attributes.state === 'string' ? s.attributes.state : 'UNKNOWN',
    }),
  )

  console.log(
    `App: ${name ?? settings.bundleId} (${settings.bundleId}, ID: ${app.id})`,
  )
  if (versions.length === 0) {
    console.log('No App Store versions found.')
  } else {
    for (const v of versions) {
      const buildInfo = v.buildNumber ? ` (Build ${v.buildNumber})` : ''
      console.log(`Version ${v.versionString}${buildInfo}: ${v.state}`)
    }
  }

  if (reviewSubmissions.length > 0) {
    console.log('Review Submissions:')
    for (const s of reviewSubmissions) {
      const items = await api.list(`/v1/reviewSubmissions/${s.id}/items`)
      const itemDesc =
        items.length === 0
          ? '0 items'
          : `${items.length} item(s): ${items.map((i) => i.id).join(', ')}`
      console.log(`- Submission ${s.id}: ${s.state} (${itemDesc})`)
    }
  }

  return {
    appId: app.id,
    bundleId: settings.bundleId,
    name,
    versions,
    reviewSubmissions,
  }
}

export function validateBuildNumber(buildNumber: string | undefined): string {
  const trimmed = buildNumber?.trim() ?? ''
  if (!/^[1-9]\d{0,3}$/.test(trimmed)) {
    throw new Error('Specify the exact tested build number (1–9999)')
  }
  return trimmed
}

// Explicit replacement is separate from submit: a queued release is never
// withdrawn merely because a caller asks to submit a different build.
export async function withdrawForReplacement(
  api: AppleApi,
  buildNumber: string,
  pause: () => Promise<void> = () =>
    new Promise((resolve) => setTimeout(resolve, 2000)),
) {
  const number = validateBuildNumber(buildNumber)
  const apps = await api.list(`/v1/apps?filter[bundleId]=${settings.bundleId}`)
  if (apps.length !== 1) throw new Error('Cannot uniquely resolve Jolito')
  const app = apps[0]!
  const response = await api.call(
    `/v1/apps/${app.id}/appStoreVersions?include=build&limit=10`,
  )
  const version = z
    .array(resourceSchema)
    .parse(response.data)
    .find((v) => v.attributes.versionString === settings.version)
  if (!version) throw new Error('App Store version missing')
  const candidates = await api.call(
    `/v1/builds?filter[app]=${app.id}&filter[version]=${number}&include=preReleaseVersion&limit=10`,
  )
  const builds = z.array(resourceSchema).parse(candidates.data)
  const build = builds[0]
  const release =
    build &&
    candidates.included.find(
      (item) => item.id === relatedId(build, 'preReleaseVersion'),
    )
  if (
    builds.length !== 1 ||
    build?.attributes.processingState !== 'VALID' ||
    build.attributes.expired !== false ||
    release?.attributes.version !== settings.version ||
    release.attributes.platform !== 'IOS'
  ) {
    throw new Error(
      'Replacement requires a processed, unexpired iOS build for the configured version',
    )
  }
  if (
    idSchema.safeParse(version.relationships.build?.data).data?.id === build.id
  ) {
    console.log(`Build ${number} is already selected; no withdrawal needed.`)
    return
  }
  const submissions = await api.list(
    `/v1/apps/${app.id}/reviewSubmissions?limit=10`,
  )
  for (const submission of submissions) {
    if (
      ![
        'WAITING_FOR_REVIEW',
        'IN_REVIEW',
        'UNRESOLVED_ISSUES',
        'CANCELING',
      ].includes(String(submission.attributes.state))
    )
      continue
    const items = await api.list(`/v1/reviewSubmissions/${submission.id}/items`)
    if (
      !items.some(
        (item) =>
          idSchema.safeParse(item.relationships.appStoreVersion?.data).data
            ?.id === version.id,
      )
    )
      continue
    if (items.length !== 1)
      throw new Error(
        'Cannot withdraw a submission containing additional items',
      )
    if (submission.attributes.state !== 'CANCELING') {
      await api.call(`/v1/reviewSubmissions/${submission.id}`, 'PATCH', {
        data: {
          type: 'reviewSubmissions',
          id: submission.id,
          attributes: { canceled: true },
        },
      })
    }
    for (let attempt = 0; attempt < 60; attempt++) {
      const current = resourceSchema.parse(
        (await api.call(`/v1/reviewSubmissions/${submission.id}`)).data,
      )
      if (current.attributes.state === 'COMPLETE') {
        console.log(
          `Withdrew previous build; replacement ${number} can now be submitted.`,
        )
        return
      }
      await pause()
    }
    throw new Error(
      'Apple is still canceling the previous submission; retry replacement after cancellation completes',
    )
  }
}

export async function submitAppStoreVersion(
  api: AppleApi,
  buildNumber: string,
) {
  const validatedBuildNumber = validateBuildNumber(buildNumber)

  const apps = await api.list(
    `/v1/apps?filter[bundleId]=${settings.bundleId}&fields[apps]=bundleId,name`,
  )
  if (apps.length !== 1)
    throw new Error('Create the Jolito app record in App Store Connect first')
  const app = apps[0]!

  const response = await api.call(
    `/v1/apps/${app.id}/appStoreVersions?include=build&limit=10`,
  )
  const versionsData = z.array(resourceSchema).parse(response.data)
  const version = versionsData.find(
    (v) => v.attributes.versionString === settings.version,
  )
  if (!version) {
    throw new Error(`App Store version ${settings.version} not found`)
  }

  const appStoreState =
    typeof version.attributes.appStoreState === 'string'
      ? version.attributes.appStoreState
      : 'UNKNOWN'

  if (appStoreState === 'WAITING_FOR_REVIEW' || appStoreState === 'IN_REVIEW') {
    const selected = idSchema.safeParse(version.relationships.build?.data)
    const queued =
      selected.success &&
      response.included.find((item) => item.id === selected.data.id)
    if (!queued || queued.attributes.version !== validatedBuildNumber) {
      throw new Error(
        'A different build is already queued; use the explicit replacement operation',
      )
    }
    console.log(
      `Version ${settings.version} is already in ${appStoreState}. No submission needed.`,
    )
    return
  }

  const builds = await api.list(
    `/v1/builds?filter[app]=${app.id}&filter[version]=${validatedBuildNumber}&limit=10`,
  )
  if (builds.length === 0) {
    throw new Error(
      `Build ${validatedBuildNumber} not found for version ${settings.version}`,
    )
  }
  const targetBuild = builds[0]!

  if (targetBuild.attributes.usesNonExemptEncryption !== false) {
    console.log(
      `Setting usesNonExemptEncryption: false on build ${validatedBuildNumber} (${targetBuild.id})...`,
    )
    await api.call(`/v1/builds/${targetBuild.id}`, 'PATCH', {
      data: {
        type: 'builds',
        id: targetBuild.id,
        attributes: {
          usesNonExemptEncryption: false,
        },
      },
    })
  }

  const buildRel = idSchema.safeParse(version.relationships.build?.data)
  const currentBuildResource = buildRel.success
    ? response.included.find(
        (r) => r.type === 'builds' && r.id === buildRel.data.id,
      )
    : undefined
  const currentBuildNumber =
    currentBuildResource &&
    typeof currentBuildResource.attributes.version === 'string'
      ? currentBuildResource.attributes.version
      : undefined

  const needsBuildPatch = currentBuildNumber !== validatedBuildNumber
  const needsReleaseTypePatch =
    version.attributes.releaseType !== 'AFTER_APPROVAL'

  if (needsBuildPatch || needsReleaseTypePatch) {
    const patchData: {
      type: 'appStoreVersions'
      id: string
      attributes?: { releaseType: string }
      relationships?: { build: { data: { type: string; id: string } } }
    } = {
      type: 'appStoreVersions',
      id: version.id,
    }
    if (needsReleaseTypePatch) {
      patchData.attributes = { releaseType: 'AFTER_APPROVAL' }
    }
    if (needsBuildPatch) {
      patchData.relationships = {
        build: relation('builds', targetBuild.id),
      }
    }
    await api.call(`/v1/appStoreVersions/${version.id}`, 'PATCH', {
      data: patchData,
    })
    console.log(
      `Updated version ${settings.version}: build=${validatedBuildNumber}, releaseType=AFTER_APPROVAL`,
    )
  }

  const existingSubmissions = await api.list(
    `/v1/apps/${app.id}/reviewSubmissions?limit=10`,
  )
  for (const sub of existingSubmissions) {
    const state =
      typeof sub.attributes.state === 'string' ? sub.attributes.state : ''
    if (state === 'UNRESOLVED_ISSUES') {
      console.log(
        `Canceling existing review submission ${sub.id} (state: ${state})...`,
      )
      await api.call(`/v1/reviewSubmissions/${sub.id}`, 'PATCH', {
        data: {
          type: 'reviewSubmissions',
          id: sub.id,
          attributes: {
            canceled: true,
          },
        },
      })
      console.log(`Canceled review submission ${sub.id}`)
    }
  }

  let activeSubmission = existingSubmissions.find(
    (sub) => sub.attributes.state === 'READY_FOR_REVIEW',
  )

  if (activeSubmission) {
    console.log(
      `Using existing review submission ${activeSubmission.id} (state: READY_FOR_REVIEW)...`,
    )
  } else {
    console.log(
      `Creating review submission for ${settings.bundleId} (Version ${settings.version})...`,
    )
    activeSubmission = resourceSchema.parse(
      (
        await api.call('/v1/reviewSubmissions', 'POST', {
          data: {
            type: 'reviewSubmissions',
            attributes: {
              platform: 'IOS',
            },
            relationships: {
              app: relation('apps', app.id),
            },
          },
        })
      ).data,
    )
  }

  const existingItems = await api.list(
    `/v1/reviewSubmissions/${activeSubmission.id}/items`,
  )
  const alreadyAttached = existingItems.some((item) => {
    const relVersion = idSchema.safeParse(
      item.relationships.appStoreVersion?.data,
    )
    return relVersion.success && relVersion.data.id === version.id
  })

  if (!alreadyAttached) {
    console.log(
      `Attaching version ${settings.version} to review submission ${activeSubmission.id}...`,
    )
    await api.call('/v1/reviewSubmissionItems', 'POST', {
      data: {
        type: 'reviewSubmissionItems',
        relationships: {
          reviewSubmission: relation('reviewSubmissions', activeSubmission.id),
          appStoreVersion: relation('appStoreVersions', version.id),
        },
      },
    })
  } else {
    console.log(
      `Version ${settings.version} is already attached to review submission ${activeSubmission.id}`,
    )
  }

  console.log(
    `Submitting review submission ${activeSubmission.id} for App Store review...`,
  )
  const submitted = resourceSchema.parse(
    (
      await api.call(`/v1/reviewSubmissions/${activeSubmission.id}`, 'PATCH', {
        data: {
          type: 'reviewSubmissions',
          id: activeSubmission.id,
          attributes: {
            submitted: true,
          },
        },
      })
    ).data,
  )

  const finalState =
    typeof submitted.attributes.state === 'string'
      ? submitted.attributes.state
      : 'WAITING_FOR_REVIEW'
  console.log(
    `Successfully submitted Version ${settings.version} for review: state=${finalState}`,
  )
}

export function token() {
  const env = z
    .object({
      APP_STORE_CONNECT_API_KEY_KEY_ID: z.string().min(1),
      APP_STORE_CONNECT_API_KEY_ISSUER_ID: z.string().uuid(),
      APP_STORE_CONNECT_API_KEY_KEY: z.string().min(1),
    })
    .safeParse(process.env)
  if (!env.success)
    throw new Error('Missing or invalid App Store Connect API credentials')
  const credentials = env.data
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString('base64url')
  const issued = Math.floor(Date.now() / 1000)
  const header = encode({
    alg: 'ES256',
    kid: credentials.APP_STORE_CONNECT_API_KEY_KEY_ID,
    typ: 'JWT',
  })
  const payload = encode({
    iss: credentials.APP_STORE_CONNECT_API_KEY_ISSUER_ID,
    iat: issued,
    exp: issued + 1200,
    aud: 'appstoreconnect-v1',
  })
  const key = createPrivateKey(
    Buffer.from(credentials.APP_STORE_CONNECT_API_KEY_KEY, 'base64'),
  )
  const signature = sign('sha256', Buffer.from(`${header}.${payload}`), {
    key,
    dsaEncoding: 'ieee-p1363',
  }).toString('base64url')
  return `${header}.${payload}.${signature}`
}

if (import.meta.main) {
  try {
    const command = process.argv[2] ?? ''
    if (
      !['--apply', '--check', '--status', '--submit', '--withdraw'].includes(
        command,
      )
    )
      throw new Error(
        'Usage: node scripts/app-store.ts --check|--apply|--status|--submit|--withdraw <build_number>',
      )
    const api = new AppleApi(token())
    if (command === '--status') {
      await checkStatus(api)
    } else if (command === '--withdraw') {
      await withdrawForReplacement(api, validateBuildNumber(process.argv[3]))
    } else if (command === '--submit') {
      const buildNumber = validateBuildNumber(process.argv[3])
      await submitAppStoreVersion(api, buildNumber)
    } else {
      await configureStore(api, command === '--apply')
    }
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : 'App Store configuration failed',
    )
    process.exitCode = 1
  }
}
