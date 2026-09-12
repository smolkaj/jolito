import { Capacitor } from '@capacitor/core'
import type {
  CommunityStats,
  CommunityStatsService,
} from '../../application/ports'
import { communityStatsSchema } from '../../domain/community-stats'

export interface CommunityStatsConfig {
  supabaseUrl?: string
  supabaseAnonKey?: string
  statsEndpoint?: string
  fetchFn?: typeof fetch
  isNative?: boolean
}

export class BrowserCommunityStatsService implements CommunityStatsService {
  private statsEndpoint: string
  private supabaseUrl: string
  private supabaseAnonKey: string
  private fetchFn: typeof fetch
  private isNative: boolean

  constructor(config: CommunityStatsConfig = {}) {
    this.isNative = config.isNative ?? Capacitor.isNativePlatform()
    this.statsEndpoint =
      config.statsEndpoint ??
      (this.isNative ? 'https://joli.to/api/stats' : '/api/stats')
    this.supabaseUrl = (
      config.supabaseUrl ??
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL
        ? import.meta.env.VITE_SUPABASE_URL
        : '')
    ).replace(/\/+$/, '')
    this.supabaseAnonKey =
      config.supabaseAnonKey ??
      (typeof import.meta !== 'undefined' &&
      import.meta.env?.VITE_SUPABASE_ANON_KEY
        ? import.meta.env.VITE_SUPABASE_ANON_KEY
        : '')
    this.fetchFn =
      config.fetchFn ?? ((input, init) => globalThis.fetch(input, init))
  }

  async getCommunityStats(
    signal?: AbortSignal,
  ): Promise<CommunityStats | null> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return null
    }

    const fetchSignal = signal
      ? AbortSignal.any([signal, AbortSignal.timeout(5_000)])
      : AbortSignal.timeout(5_000)

    // 1. Try edge endpoint first (cached on Cloudflare edge with $0 DB cost)
    try {
      const res = await this.fetchFn(this.statsEndpoint, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: fetchSignal,
      })
      if (res.ok) {
        const json: unknown = await res.json()
        const parsed = communityStatsSchema.safeParse(json)
        if (parsed.success) {
          return parsed.data
        }
      }
    } catch {
      // Fall through to direct Supabase RPC fallback on native platforms
    }

    // 2. Direct Supabase RPC fallback (native Capacitor only, e.g. iOS where edge routes don't exist on origin)
    if (this.isNative && this.supabaseUrl && this.supabaseAnonKey) {
      try {
        const res = await this.fetchFn(
          `${this.supabaseUrl}/rest/v1/rpc/get_community_stats`,
          {
            method: 'POST',
            headers: {
              apikey: this.supabaseAnonKey,
              Authorization: `Bearer ${this.supabaseAnonKey}`,
              'Content-Type': 'application/json',
            },
            signal: fetchSignal,
          },
        )
        if (res.ok) {
          const json: unknown = await res.json()
          const parsed = communityStatsSchema.safeParse(json)
          if (parsed.success) {
            return parsed.data
          }
        }
      } catch {
        // Fall through to graceful null
      }
    }

    return null
  }
}
