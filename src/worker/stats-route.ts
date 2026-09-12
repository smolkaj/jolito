import {
  communityStatsSchema,
  type CommunityStats,
} from '../domain/community-stats.ts'

export type { CommunityStats }

export interface StatsWorkerEnv {
  SUPABASE_URL?: string | undefined
  SUPABASE_ANON_KEY?: string | undefined
  [key: string]: unknown
}

export interface StatsRouteDependencies {
  fetchFn?: typeof fetch
}

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
}

export async function handleCommunityStatsRequest(
  request: Request,
  env?: StatsWorkerEnv,
  deps?: StatsRouteDependencies,
): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    })
  }

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        Allow: 'GET, OPTIONS',
      },
    })
  }

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
      JSON.stringify({ error: 'Community stats service is not configured' }),
      {
        status: 503,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    )
  }

  const cacheKey = new Request(
    new URL('/api/stats', request.url).toString(),
    request,
  )
  let cache: Cache | undefined
  if (typeof caches !== 'undefined' && 'default' in caches) {
    try {
      cache = (caches as unknown as { default: Cache }).default
      const cachedResponse = await cache.match(cacheKey)
      if (cachedResponse) {
        return cachedResponse
      }
    } catch {
      // Non-Cloudflare environments may throw; proceed with fetch
    }
  }

  const fetcher = deps?.fetchFn ?? fetch

  try {
    const res = await fetcher(
      `${supabaseUrl}/rest/v1/rpc/get_community_stats`,
      {
        method: 'POST',
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10_000),
      },
    )

    if (!res.ok) {
      return new Response(
        JSON.stringify({
          error: `Failed to retrieve stats from database (HTTP ${res.status})`,
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

    const json: unknown = await res.json()
    const stats = communityStatsSchema.parse(json)

    const response = new Response(JSON.stringify(stats), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control':
          'public, max-age=300, s-maxage=900, stale-while-revalidate=3600',
      },
    })

    if (cache) {
      try {
        await cache.put(cacheKey, response.clone())
      } catch {
        // Cache put failure shouldn't fail request
      }
    }

    return response
  } catch (err) {
    return new Response(
      JSON.stringify({
        error:
          err instanceof Error
            ? err.message
            : 'Internal error retrieving community stats',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    )
  }
}
