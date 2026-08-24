import type { AuthUser, SyncResult, SyncService } from '../../application/ports'
import type { StudyCard } from '../../domain/card'
import {
  deckSyncPayloadSchema,
  reconcileStudyCards,
  type DeckSyncPayload,
  type SyncStatus,
} from '../../domain/sync'
import type { SupabaseAuthService } from './auth-service'

export class SupabaseSyncService implements SyncService {
  private status: SyncStatus = 'idle'
  private deviceId: string

  constructor(
    private authService: SupabaseAuthService,
    private supabaseUrl: string = import.meta.env.VITE_SUPABASE_URL ?? '',
    private supabaseAnonKey: string = import.meta.env.VITE_SUPABASE_ANON_KEY ??
      '',
    deviceId?: string,
  ) {
    this.deviceId = deviceId || this.getOrCreateDeviceId()
  }

  private getOrCreateDeviceId(): string {
    const key = 'jolito-device-id-v1'
    if (typeof window === 'undefined' || !window.localStorage) {
      return 'device-server'
    }
    let id = window.localStorage.getItem(key)
    if (!id) {
      id = `dev-${Math.random().toString(36).slice(2, 10)}`
      window.localStorage.setItem(key, id)
    }
    return id
  }

  getStatus(): SyncStatus {
    return this.status
  }

  private getAuthHeaders(): Record<string, string> | null {
    const token = this.authService.getAccessToken()
    if (!token || !this.supabaseAnonKey) {
      return null
    }
    return {
      apikey: this.supabaseAnonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }
  }

  async pullDeck(user: AuthUser): Promise<SyncResult> {
    if (!this.supabaseUrl || !this.supabaseAnonKey) {
      return { success: false, error: 'Cloud sync backend is not configured.' }
    }

    const headers = this.getAuthHeaders()
    if (!headers) {
      return { success: false, error: 'Sign in to access your cloud deck.' }
    }

    try {
      const fetchUrl = `${this.supabaseUrl}/rest/v1/decks?user_id=eq.${encodeURIComponent(user.id)}&select=*`
      const res = await fetch(fetchUrl, { headers })

      if (!res.ok) {
        return {
          success: false,
          error: `Cloud fetch failed (HTTP ${res.status}).`,
        }
      }

      const rows = (await res.json()) as Array<{
        user_id: string
        updated_at: string
        data: unknown
      }>

      if (!rows || rows.length === 0) {
        return { success: true, cards: [] }
      }

      const first = rows[0]
      if (!first) {
        return { success: true, cards: [] }
      }

      const parseResult = deckSyncPayloadSchema.safeParse(first.data)
      if (!parseResult.success) {
        return {
          success: false,
          error: 'Remote deck data did not match the Jolito sync schema.',
        }
      }

      return {
        success: true,
        cards: parseResult.data.cards,
        syncedAt: new Date(first.updated_at).getTime(),
      }
    } catch (err) {
      return {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : 'Network error pulling cloud deck.',
      }
    }
  }

  async pushDeck(cards: StudyCard[], user: AuthUser): Promise<SyncResult> {
    if (!this.supabaseUrl || !this.supabaseAnonKey) {
      return { success: false, error: 'Cloud sync backend is not configured.' }
    }

    const headers = this.getAuthHeaders()
    if (!headers) {
      return { success: false, error: 'Sign in to sync your deck.' }
    }

    try {
      const nowIso = new Date().toISOString()
      const payload: DeckSyncPayload = {
        version: 1,
        app: 'jolito',
        updatedAt: nowIso,
        deviceId: this.deviceId,
        cards,
      }

      const res = await fetch(
        `${this.supabaseUrl}/rest/v1/decks?on_conflict=user_id`,
        {
          method: 'POST',
          headers: {
            ...headers,
            Prefer: 'resolution=merge-duplicates',
          },
          body: JSON.stringify({
            user_id: user.id,
            updated_at: nowIso,
            device_id: this.deviceId,
            version: 1,
            data: payload,
          }),
        },
      )
      if (!res.ok) {
        return {
          success: false,
          error: `Cloud push failed (HTTP ${res.status}).`,
        }
      }

      return {
        success: true,
        cards,
        syncedAt: new Date(nowIso).getTime(),
      }
    } catch (err) {
      return {
        success: false,
        error:
          err instanceof Error ? err.message : 'Network error pushing deck.',
      }
    }
  }

  async syncDeck(localCards: StudyCard[], user: AuthUser): Promise<SyncResult> {
    this.status = 'syncing'

    const pullRes = await this.pullDeck(user)
    if (!pullRes.success) {
      this.status = 'error'
      return pullRes
    }

    const remoteCards = pullRes.cards || []
    const merged = reconcileStudyCards(localCards, remoteCards)

    const pushRes = await this.pushDeck(merged, user)
    if (!pushRes.success) {
      this.status = 'error'
      return pushRes
    }

    this.status = 'synced'
    return {
      success: true,
      cards: merged,
      syncedAt: pushRes.syncedAt,
    }
  }
}
