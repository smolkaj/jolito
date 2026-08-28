import type {
  AuthService,
  AuthUser,
  FeedbackResult,
  FeedbackService,
  FeedbackSubmission,
} from '../../application/ports'
import { feedbackSubmissionSchema } from '../../domain/feedback'

export class SupabaseFeedbackService implements FeedbackService {
  constructor(
    private authService: AuthService,
    private supabaseUrl: string = import.meta.env.VITE_SUPABASE_URL ?? '',
    private supabaseAnonKey: string = import.meta.env.VITE_SUPABASE_ANON_KEY ??
      '',
  ) {}

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
    user: AuthUser,
  ): Promise<FeedbackResult> {
    const validation = feedbackSubmissionSchema.safeParse(submission)
    if (!validation.success) {
      return {
        success: false,
        error:
          validation.error.issues?.[0]?.message ??
          validation.error.message ??
          'Invalid feedback submission.',
      }
    }

    if (!user || !user.id || !user.email) {
      return { success: false, error: 'Sign in to send feedback.' }
    }

    if (!this.supabaseUrl || !this.supabaseAnonKey) {
      return {
        success: false,
        error: 'Feedback service is not configured.',
      }
    }

    let headers = await this.getAuthHeaders()
    if (!headers) {
      return { success: false, error: 'Sign in to send feedback.' }
    }

    const payload = {
      user_id: user.id,
      email: user.email,
      category: validation.data.category,
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

      if (res.status === 401 && this.authService.refreshSession) {
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
        return {
          success: false,
          error:
            errorText ||
            `Failed to send feedback (HTTP ${res.status}). Please try again.`,
        }
      }

      return { success: true }
    } catch (err) {
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
