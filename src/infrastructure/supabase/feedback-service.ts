import type {
  AuthService,
  AuthUser,
  FeedbackResult,
  FeedbackService,
  FeedbackSubmission,
} from '../../application/ports'
import { feedbackSubmissionSchema } from '../../domain/feedback'

export class SupabaseFeedbackService implements FeedbackService {
  private supabaseUrl: string
  private supabaseAnonKey: string

  constructor(
    private authService: AuthService,
    supabaseUrl: string = import.meta.env.VITE_SUPABASE_URL ?? '',
    supabaseAnonKey: string = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
  ) {
    this.supabaseUrl = (supabaseUrl || '').replace(/\/+$/, '')
    this.supabaseAnonKey = supabaseAnonKey
  }

  private async getAuthHeaders(): Promise<Record<string, string> | null> {
    const token = (await this.authService.getAccessToken?.()) ?? null
    if (!token || !this.supabaseAnonKey) {
      return null
    }
    return {
      apikey: this.supabaseAnonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    }
  }

  async submitFeedback(
    submission: FeedbackSubmission,
    user: AuthUser | null,
  ): Promise<FeedbackResult> {
    const validation = feedbackSubmissionSchema.safeParse(submission)
    if (!validation.success) {
      const errorMsg =
        validation.error.issues?.[0]?.message ??
        validation.error.message ??
        'Invalid feedback submission.'
      console.error('[FeedbackService] Validation error:', errorMsg)
      return {
        success: false,
        error: errorMsg,
      }
    }

    if (!this.supabaseUrl || !this.supabaseAnonKey) {
      console.error(
        '[FeedbackService] Feedback service is not configured (missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY).',
      )
      return {
        success: false,
        error: 'Feedback service is not configured.',
      }
    }

    let headers: Record<string, string>
    if (user) {
      const authHeaders = await this.getAuthHeaders()
      if (!authHeaders) {
        console.error(
          '[FeedbackService] Cannot submit authenticated feedback: missing access token.',
        )
        return { success: false, error: 'Sign in to send feedback.' }
      }
      headers = authHeaders
    } else {
      // For unauthenticated guest submissions, use the Supabase anon key
      headers = {
        apikey: this.supabaseAnonKey,
        Authorization: `Bearer ${this.supabaseAnonKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      }
    }

    const payload = {
      user_id: user?.id ?? null,
      email: user?.email ?? 'guest@jolito.app',
      message: validation.data.message,
      context: validation.data.context ?? {},
    }

    try {
      const postUrl = `${this.supabaseUrl}/rest/v1/feedback`
      let res = await fetch(postUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })

      if (res.status === 401 && user && this.authService.refreshSession) {
        const refreshedToken = await this.authService.refreshSession()
        if (refreshedToken) {
          headers = {
            ...headers,
            Authorization: `Bearer ${refreshedToken}`,
          }
          res = await fetch(postUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
          })
        }
      }

      if (!res.ok) {
        const errorText = await res.text().catch(() => '')
        let errorPayload: {
          code?: string
          message?: string
          details?: string | null
          hint?: string | null
        } | null = null
        try {
          if (errorText) {
            errorPayload = JSON.parse(errorText) as {
              code?: string
              message?: string
              details?: string | null
              hint?: string | null
            }
          }
        } catch {
          // not JSON
        }

        console.error('[FeedbackService] Submission failed:', {
          status: res.status,
          statusText: res.statusText,
          code: errorPayload?.code,
          message: errorPayload?.message,
          details: errorPayload?.details,
          hint: errorPayload?.hint,
          rawError: errorText,
        })

        const displayError =
          errorPayload?.message ||
          (errorText && !errorText.startsWith('{') ? errorText : null) ||
          `Failed to send feedback (HTTP ${res.status}). Please try again.`

        return {
          success: false,
          error: displayError,
        }
      }

      return { success: true }
    } catch (err) {
      console.error(
        '[FeedbackService] Unexpected network or client error:',
        err,
      )
      return {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : 'Network error sending feedback.',
      }
    }
  }
}
