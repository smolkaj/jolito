import { handleTtsRequest } from './tts-route'
import { handleFeedbackRequest, type FeedbackWorkerEnv } from './feedback-route'

export interface WorkerEnv extends FeedbackWorkerEnv {
  ASSETS?: {
    fetch: (request: Request) => Promise<Response>
  }
}

export default {
  async fetch(request: Request, env?: WorkerEnv): Promise<Response> {
    const url = new URL(request.url)
    const pathname = url.pathname.replace(/\/+$/, '')
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
