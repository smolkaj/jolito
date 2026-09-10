import type {
  SignupNotificationPayload,
  SignupNotificationService,
} from '../../application/ports'

export class BrowserSignupNotificationService implements SignupNotificationService {
  constructor(
    private endpoint: string = '/api/signup',
    private storage: Storage = typeof window !== 'undefined'
      ? window.localStorage
      : ({} as Storage),
  ) {}

  async notifySignup(payload: SignupNotificationPayload): Promise<{
    success: boolean
    error?: string | undefined
  }> {
    const storageKey = `jolito-signup-notified-${payload.userId}`
    if (this.storage.getItem?.(storageKey)) {
      return { success: true }
    }

    try {
      let targetUrl = this.endpoint
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

      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: payload.email,
          user_id: payload.userId,
          context: payload.context ?? {},
        }),
        keepalive: true,
      })

      if (!res.ok) {
        const errorText = await res.text().catch(() => '')
        return {
          success: false,
          error: `Failed to dispatch signup notification (HTTP ${res.status}): ${errorText}`,
        }
      }

      this.storage.setItem?.(storageKey, 'true')
      return { success: true }
    } catch (err) {
      console.warn(
        '[SignupNotificationService] Non-fatal notification dispatch error:',
        err,
      )
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }
}
