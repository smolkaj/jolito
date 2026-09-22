import {
  telemetryPayloadSchema,
  computeMonthlyUserHash,
  type TelemetryPayload,
} from '../domain/telemetry.ts'

export type { TelemetryPayload }

export interface TelemetryWorkerEnv {
  SUPABASE_URL?: string | undefined
  SUPABASE_ANON_KEY?: string | undefined
  TELEMETRY_SECRET?: string | undefined
  [key: string]: unknown
}

export interface TelemetryRouteDependencies {
  fetchFn?: typeof fetch
  nowFn?: () => Date
}

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
}

export function extractCountryFromRequest(request: Request): string {
  const cf = (request as unknown as { cf?: { country?: string } }).cf
  if (
    cf?.country &&
    typeof cf.country === 'string' &&
    cf.country.trim().length === 2
  ) {
    return cf.country.trim().toLowerCase()
  }
  // Fallback for local dev and testing environments without Cloudflare runtime
  const headerCountry = request.headers.get('cf-ipcountry')
  if (headerCountry && headerCountry.trim().length === 2) {
    return headerCountry.trim().toLowerCase()
  }
  return 'unknown'
}

export async function handleTelemetryRequest(
  request: Request,
  env?: TelemetryWorkerEnv,
  deps?: TelemetryRouteDependencies,
): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    })
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        Allow: 'POST, OPTIONS',
      },
    })
  }

  let rawJson: unknown
  try {
    rawJson = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    })
  }

  const parseResult = telemetryPayloadSchema.safeParse(rawJson)
  if (!parseResult.success) {
    return new Response(
      JSON.stringify({
        error: 'Validation failed',
        details: parseResult.error.flatten(),
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    )
  }

  const payload = parseResult.data
  const supabaseUrl = (
    env !== undefined
      ? env.SUPABASE_URL || ''
      : (typeof process !== 'undefined' &&
          (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL)) ||
        ''
  ).replace(/\/+$/, '')

  const supabaseAnonKey =
    env !== undefined
      ? env.SUPABASE_ANON_KEY || ''
      : (typeof process !== 'undefined' &&
          (process.env.VITE_SUPABASE_ANON_KEY ||
            process.env.SUPABASE_ANON_KEY)) ||
        ''

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(
      JSON.stringify({ error: 'Telemetry service is not configured' }),
      {
        status: 503,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    )
  }

  const now = deps?.nowFn ? deps.nowFn() : new Date()
  const yearMonth = now.toISOString().slice(0, 7)
  const salt = env?.TELEMETRY_SECRET || 'jolito-privacy-telemetry-salt-2026'

  const userHash = await computeMonthlyUserHash(
    payload.deviceId,
    yearMonth,
    salt,
  )
  const country = extractCountryFromRequest(request)

  const fetcher = deps?.fetchFn ?? fetch

  try {
    const res = await fetcher(
      `${supabaseUrl}/rest/v1/rpc/record_client_activity`,
      {
        method: 'POST',
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          p_user_hash: userHash,
          p_country: country,
          p_platform: payload.platform,
          p_os: payload.os,
          p_browser: payload.browser,
          p_device_type: payload.deviceType,
          p_engagement_tier: payload.engagementTier,
        }),
      },
    )

    if (!res.ok) {
      const errorText = await res.text().catch(() => '')
      return new Response(
        JSON.stringify({
          error: 'Failed to record telemetry',
          details: errorText,
        }),
        {
          status: 502,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        },
      )
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'Telemetry upstream connection failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 502,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    )
  }
}
