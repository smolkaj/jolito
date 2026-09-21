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

function isUpdateHelpMessage(message: string): boolean {
  return (
    message.includes('/update') || message.includes('Update Jolito to sync')
  )
}

export class SupabaseSyncService implements SyncService {
  private readonly deviceId: string
  private readonly supabaseUrl: string
  private readonly alertEndpoint: string | null
  private readonly reportedAnomalies = new Set<string>()

  constructor(
    private readonly authService: AuthService,
    supabaseUrl: string = import.meta.env.VITE_SUPABASE_URL ?? '',
    private readonly supabaseAnonKey: string = import.meta.env
      .VITE_SUPABASE_ANON_KEY ?? '',
    deviceId?: string,
    alertEndpoint: string | null = '/api/alerts/sync-anomaly',
  ) {
    this.supabaseUrl = supabaseUrl.replace(/\/+$/, '')
    this.deviceId = deviceId ?? getOrCreateDeviceId()
    this.alertEndpoint = alertEndpoint
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
        if (error?.code === 'PGRST202')
          throw new Error(
            'Cloud sync is being updated. Your local changes are saved. Please try syncing again shortly; update help is at https://joli.to/update.',
          )
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
        'rpc/read_deck_snapshot',
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
      if (!rows.success) {
        void this.reportSyncAnomaly(user.id, response, rows.error.issues)
        return {
          success: false,
          error: 'Update Jolito to sync.',
          syncHelp: true,
        }
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
      const message =
        error instanceof Error
          ? error.message
          : 'Network error pulling cloud deck.'
      return {
        success: false,
        error: message,
        ...(isUpdateHelpMessage(message) ? { syncHelp: true } : {}),
      }
    }
  }

  private async reportSyncAnomaly(
    userId: string,
    rawResponse: unknown,
    issues: z.ZodIssue[],
  ): Promise<void> {
    if (!this.alertEndpoint) return
    try {
      let revision: number | null = null
      if (
        Array.isArray(rawResponse) &&
        rawResponse[0] &&
        typeof rawResponse[0] === 'object'
      ) {
        const rawRev = (rawResponse[0] as Record<string, unknown>).revision
        if (typeof rawRev === 'number') revision = rawRev
      }

      const dedupeKey = `${userId}:${revision ?? 'null'}`
      if (this.reportedAnomalies.has(dedupeKey)) {
        return
      }
      this.reportedAnomalies.add(dedupeKey)

      const sanitizedIssues = issues.slice(0, 20).map((issue) => ({
        path: issue.path,
        code: issue.code,
        message: issue.message,
        expected:
          'expected' in issue && typeof issue.expected === 'string'
            ? issue.expected
            : undefined,
        received:
          'received' in issue && typeof issue.received === 'string'
            ? issue.received
            : undefined,
      }))

      let targetUrl = this.alertEndpoint
      if (
        !targetUrl.startsWith('http://') &&
        !targetUrl.startsWith('https://') &&
        typeof window !== 'undefined'
      ) {
        const isCapacitor = window.location?.protocol === 'capacitor:'
        const baseOrigin = isCapacitor
          ? 'https://joli.to'
          : window.location?.origin || 'https://joli.to'
        targetUrl = new URL(targetUrl, baseOrigin).toString()
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      try {
        const token = await this.authService.getAccessToken?.()
        if (token) {
          headers['Authorization'] = `Bearer ${token}`
        }
      } catch {
        // Token retrieval failure should not block alert delivery
      }

      await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId,
          revision,
          clientVersion: collectionVersion,
          deviceId: this.deviceId,
          issues: sanitizedIssues,
        }),
        keepalive: true,
      })
    } catch (err) {
      console.warn(
        '[SyncService] Non-fatal sync anomaly alert dispatch error:',
        err,
      )
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
        if (!remote.success) return remote
        if (remote.revision === undefined)
          throw new Error('Cloud snapshot revision is missing.')
        pending = reconcileStudyCards(
          pending.cards,
          remote.cards ?? [],
          pending.deletedCardIds,
          remote.deletedCardIds ?? [],
        )
        const now = new Date().toISOString()
        const payload = deckSyncPayloadSchema.parse({
          version: collectionVersion,
          app: 'jolito',
          updatedAt: now,
          deviceId: this.deviceId,
          ...pending,
        })
        const response = await this.request(
          user,
          'rpc/compare_and_set_deck',
          {
            p_user_id: user.id,
            p_expected_revision: remote.revision,
            p_data: payload,
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
      const message =
        error instanceof Error ? error.message : 'Network error syncing deck.'
      return {
        success: false,
        error: message,
        ...(isUpdateHelpMessage(message) ? { syncHelp: true } : {}),
      }
    }
  }
}
