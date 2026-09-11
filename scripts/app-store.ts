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
    if (!response.ok)
      throw new Error(
        `Apple API ${method} ${url.pathname}: HTTP ${response.status}`,
      )
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
  const apps = await api.list(`/v1/apps?filter[bundleId]=${settings.bundleId}`)
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
    await api.call(
      '/v1/appPriceSchedules',
      'POST',
      priceSchedule(app.id, point.id),
    )
    // POST replaces the availability selection, including on an existing app.
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
  console.log(
    'Verified US$2.99 base price and configured worldwide availability. Apple eligibility and agreements still apply.',
  )
}

function token() {
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
    if (!['--apply', '--check'].includes(process.argv[2] ?? ''))
      throw new Error('Usage: node scripts/app-store.ts --check|--apply')
    await configureStore(new AppleApi(token()), process.argv[2] === '--apply')
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : 'App Store configuration failed',
    )
    process.exitCode = 1
  }
}
