import { describe, expect, it, vi } from 'vitest'
import { BrowserCommunityStatsService } from './community-stats-service'

describe('BrowserCommunityStatsService', () => {
  it('returns stats from edge endpoint when available', async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/stats') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              learners: 3,
              cards: 284,
              reviews: 310,
            }),
            { status: 200 },
          ),
        )
      }
      return Promise.reject(new Error('Unexpected call'))
    })

    const service = new BrowserCommunityStatsService({
      fetchFn: mockFetch,
    })

    const stats = await service.getCommunityStats()
    expect(stats).toEqual({
      learners: 3,
      cards: 284,
      reviews: 310,
    })
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('falls back to Supabase RPC when edge endpoint returns error on native platforms', async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/stats') {
        return Promise.resolve(new Response('Not Found', { status: 404 }))
      }
      if (url === 'https://test.supabase.co/rest/v1/rpc/get_community_stats') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              learners: 5,
              cards: 50,
              reviews: 100,
            }),
            { status: 200 },
          ),
        )
      }
      return Promise.reject(new Error('Unexpected URL'))
    })

    const service = new BrowserCommunityStatsService({
      supabaseUrl: 'https://test.supabase.co',
      supabaseAnonKey: 'anon-key-xyz',
      fetchFn: mockFetch,
      isNative: true,
    })

    const stats = await service.getCommunityStats()
    expect(stats).toEqual({
      learners: 5,
      cards: 50,
      reviews: 100,
    })
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('does not fall back to Supabase RPC on web browsers to protect DB costs', async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/stats') {
        return Promise.resolve(new Response('Not Found', { status: 404 }))
      }
      return Promise.reject(new Error('Unexpected URL'))
    })

    const service = new BrowserCommunityStatsService({
      supabaseUrl: 'https://test.supabase.co',
      supabaseAnonKey: 'anon-key-xyz',
      fetchFn: mockFetch,
      isNative: false,
    })

    const stats = await service.getCommunityStats()
    expect(stats).toBeNull()
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('returns null immediately when navigator is offline without making network requests', async () => {
    const mockFetch = vi.fn()
    const originalOnLine = navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      configurable: true,
    })

    try {
      const service = new BrowserCommunityStatsService({
        fetchFn: mockFetch,
      })
      const stats = await service.getCommunityStats()
      expect(stats).toBeNull()
      expect(mockFetch).not.toHaveBeenCalled()
    } finally {
      Object.defineProperty(navigator, 'onLine', {
        value: originalOnLine,
        configurable: true,
      })
    }
  })

  it('returns null gracefully when network fails or all endpoints fail', async () => {
    const mockFetch = vi
      .fn()
      .mockRejectedValue(new TypeError('Failed to fetch'))

    const service = new BrowserCommunityStatsService({
      supabaseUrl: 'https://test.supabase.co',
      supabaseAnonKey: 'anon-key-xyz',
      fetchFn: mockFetch,
      isNative: true,
    })

    const stats = await service.getCommunityStats()
    expect(stats).toBeNull()
  })

  it('returns null when payload fails schema validation', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ invalid: true }), { status: 200 }),
      )

    const service = new BrowserCommunityStatsService({
      fetchFn: mockFetch,
    })

    const stats = await service.getCommunityStats()
    expect(stats).toBeNull()
  })
})
