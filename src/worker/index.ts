import { handleTtsRequest } from './tts-route'
import { handleFeedbackRequest, type FeedbackWorkerEnv } from './feedback-route'

export interface WorkerEnv extends FeedbackWorkerEnv {
  TTS_RATE_LIMIT?: {
    limit(input: { key: string }): Promise<{ success: boolean }>
  }
  FEEDBACK_RATE_LIMIT?: {
    limit(input: { key: string }): Promise<{ success: boolean }>
  }
  ASSETS?: {
    fetch: (request: Request) => Promise<Response>
  }
}

export default {
  async fetch(request: Request, env?: WorkerEnv): Promise<Response> {
    const url = new URL(request.url)
    const pathname = url.pathname.replace(/\/+$/, '')
    if (
      env &&
      request.method !== 'OPTIONS' &&
      (pathname === '/api/tts' || pathname === '/api/feedback')
    ) {
      const limiter =
        pathname === '/api/tts' ? env.TTS_RATE_LIMIT : env.FEEDBACK_RATE_LIMIT
      try {
        if (!limiter) throw new Error('Rate limiting is not configured')
        const key = `${url.hostname}:${request.headers.get('CF-Connecting-IP') ?? 'unknown'}`
        if (!(await limiter.limit({ key })).success) {
          return Response.json(
            { error: 'A little breather—please try again in a minute.' },
            {
              status: 429,
              headers: {
                'Retry-After': '60',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'no-store',
              },
            },
          )
        }
      } catch {
        return Response.json(
          { error: 'Temporarily unavailable. Please try again shortly.' },
          {
            status: 503,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'no-store',
            },
          },
        )
      }
    }
    if (pathname === '/api/tts') {
      return handleTtsRequest(request)
    }
    if (pathname === '/api/feedback') {
      return handleFeedbackRequest(request, env)
    }

    if (env?.ASSETS) {
      return env.ASSETS.fetch(request)
    }

    return new Response('Not Found', { status: 404 })
  },
}
