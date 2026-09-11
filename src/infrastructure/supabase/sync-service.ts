import { getOrCreateDeviceId } from '../browser/device-id'
import { z } from 'zod'
import { collectionVersion } from '../../domain/card'
import type {
  AuthService,
  AuthUser,
  SyncResult,
  SyncService,
} from '../../application/ports'
import type { StudyCard } from '../../domain/card'
import { deckSyncPayloadSchema, reconcileStudyCards } from '../../domain/sync'
import { parsePostgrestErrorPayload } from './postgrest-error'
import { withRequestDeadline } from '../request-lifetime'

const revisionSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
const MAX_SYNC_ATTEMPTS = 3

export class SupabaseSyncService implements SyncService {
  private readonly deviceId: string
  private readonly supabaseUrl: string

  constructor(
    private readonly authService: AuthService,
    supabaseUrl: string = import.meta.env.VITE_SUPABASE_URL ?? '',
    private readonly supabaseAnonKey: string = import.meta.env
      .VITE_SUPABASE_ANON_KEY ?? '',
    deviceId?: string,
  ) {
    this.supabaseUrl = supabaseUrl.replace(/\/+$/, '')
    this.deviceId = deviceId ?? getOrCreateDeviceId()
  }

  private async request(
    user: AuthUser,
    path: string,
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<unknown> {
    if (!this.supabaseUrl || !this.supabaseAnonKey)
      throw new Error('Cloud sync backend is not configured.')
    return withRequestDeadline(async (requestSignal) => {
      const assertOwner = () => {
        if (requestSignal.aborted)
          throw new Error('Cloud sync was interrupted.')
        if (!this.authService.isCurrentOwner(user.id))
          throw new Error('Your account changed. Please sync again.')
      }
      assertOwner()
      const token = await this.authService.getAccessToken?.()
      assertOwner()
      if (!token) throw new Error('Sign in to sync your deck.')
      const send = (accessToken: string) =>
        fetch(`${this.supabaseUrl}/rest/v1/${path}`, {
          method: body === undefined ? 'GET' : 'POST',
          headers: {
            apikey: this.supabaseAnonKey,
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          signal: requestSignal,
        })
      let response = await send(token)
      assertOwner()
      if (response.status === 401) {
        const refreshed = await this.authService.refreshSession?.()
        assertOwner()
        if (refreshed) response = await send(refreshed)
        assertOwner()
      }
      if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        assertOwner()
        const error = parsePostgrestErrorPayload(errorText)
        throw new Error(
          error?.message ||
            `Cloud sync failed (HTTP ${response.status}). Please try again.`,
        )
      }
      const data: unknown = await response.json()
      assertOwner()
      return data
    }, signal)
  }

  async pullDeck(user: AuthUser, signal?: AbortSignal): Promise<SyncResult> {
    try {
      const response = await this.request(
        user,
        `decks?user_id=eq.${encodeURIComponent(user.id)}&select=user_id,revision,updated_at,data`,
        undefined,
        signal,
      )
      const rows = z
        .array(
          z.object({
            user_id: z.literal(user.id),
            revision: revisionSchema,
            updated_at: z.iso.datetime({ offset: true }),
            data: deckSyncPayloadSchema,
          }),
        )
        .max(1)
        .safeParse(response)
      if (!rows.success)
        return {
          success: false,
          error: 'Remote deck data did not match the Jolito sync schema.',
        }
      const row = rows.data[0]
      if (!row)
        return { success: true, cards: [], deletedCardIds: [], revision: 0 }
      return {
        success: true,
        cards: row.data.cards,
        deletedCardIds: row.data.deletedCardIds,
        revision: row.revision,
        syncedAt: new Date(row.updated_at).getTime(),
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Network error pulling cloud deck.',
      }
    }
  }

  async syncDeck(
    localCards: StudyCard[],
    user: AuthUser,
    localDeletedIds: string[] = [],
    signal?: AbortSignal,
  ): Promise<SyncResult> {
    try {
      let pending = { cards: localCards, deletedCardIds: localDeletedIds }
      for (let attempt = 0; attempt < MAX_SYNC_ATTEMPTS; attempt++) {
        if (signal?.aborted) throw new Error('Cloud sync was interrupted.')
        const remote = await this.pullDeck(user, signal)
        if (!remote.success) throw new Error(remote.error)
        if (remote.revision === undefined)
          throw new Error('Cloud snapshot revision is missing.')
        pending = reconcileStudyCards(
          pending.cards,
          remote.cards ?? [],
          pending.deletedCardIds,
          remote.deletedCardIds ?? [],
        )
        const now = new Date().toISOString()
        const response = await this.request(
          user,
          'rpc/compare_and_set_deck',
          {
            p_user_id: user.id,
            p_expected_revision: remote.revision,
            p_data: {
              version: collectionVersion,
              app: 'jolito',
              updatedAt: now,
              deviceId: this.deviceId,
              ...pending,
            },
          },
          signal,
        )
        const revision = revisionSchema.nullable().parse(response)
        if (revision === null) continue
        if (revision !== remote.revision + 1)
          throw new Error(
            'Cloud snapshot revision did not advance as expected.',
          )
        return {
          success: true,
          ...pending,
          revision,
          syncedAt: new Date(now).getTime(),
        }
      }
      throw new Error(
        'Your deck changed on another device. Your local changes are saved; please sync again.',
      )
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Network error syncing deck.',
      }
    }
  }
}
