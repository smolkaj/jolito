import { describe, expect, it, vi } from 'vitest'
import { handleCommunityStatsRequest, type StatsWorkerEnv } from './stats-route'

describe('handleCommunityStatsRequest', () => {
  const defaultEnv: StatsWorkerEnv = {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'anon-test-key',
  }

  it('handles OPTIONS preflight with 204 and CORS', async () => {
    const req = new Request('https://joli.to/api/stats', { method: 'OPTIONS' })
    const res = await handleCommunityStatsRequest(req, defaultEnv)
    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })

  it('rejects POST or other methods with 405', async () => {
    const req = new Request('https://joli.to/api/stats', { method: 'POST' })
    const res = await handleCommunityStatsRequest(req, defaultEnv)
    expect(res.status).toBe(405)
    const body = (await res.json()) as { error?: string }
    expect(body.error).toBe('Method not allowed')
  })

  it('returns 503 when Supabase credentials are missing', async () => {
    const req = new Request('https://joli.to/api/stats')
    const res = await handleCommunityStatsRequest(req, {})
    expect(res.status).toBe(503)
  })

  it('fetches stats from Supabase RPC, returns 200 and cache headers', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          learners: 3,
          cards: 284,
          reviews: 310,
        }),
        { status: 200 },
      ),
    )

    const req = new Request('https://joli.to/api/stats')
    const res = await handleCommunityStatsRequest(req, defaultEnv, {
      fetchFn: mockFetch,
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toContain('public')
    expect(res.headers.get('Cache-Control')).toContain('s-maxage=900')
    const data: unknown = await res.json()
    expect(data).toEqual({
      learners: 3,
      cards: 284,
      reviews: 310,
    })

    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.supabase.co/rest/v1/rpc/get_community_stats',
      expect.objectContaining({
        method: 'POST',
        headers: {
          apikey: 'anon-test-key',
          Authorization: 'Bearer anon-test-key',
          'Content-Type': 'application/json',
        },
      }),
    )
  })

  it('returns 502 when Supabase RPC fails', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Database error' }), {
        status: 500,
      }),
    )

    const req = new Request('https://joli.to/api/stats')
    const res = await handleCommunityStatsRequest(req, defaultEnv, {
      fetchFn: mockFetch,
    })

    expect(res.status).toBe(502)
  })
})
