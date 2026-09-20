import { handleTtsRequest } from './tts-route'
import { handleFeedbackRequest, type FeedbackWorkerEnv } from './feedback-route'
import { handleCommunityStatsRequest, type StatsWorkerEnv } from './stats-route'
import { handleAiRequest, type AiWorkerEnv } from './ai-route'
import {
  handleSyncAlertRequest,
  type SyncAlertWorkerEnv,
} from './sync-alert-route'

export interface WorkerEnv
  extends FeedbackWorkerEnv, StatsWorkerEnv, AiWorkerEnv, SyncAlertWorkerEnv {
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
    if (pathname === '/api/stats') {
      return handleCommunityStatsRequest(request, env)
    }
    if (pathname === '/api/ai') {
      return handleAiRequest(request, env)
    }
    if (pathname === '/api/alerts/sync-anomaly') {
      return handleSyncAlertRequest(request, env)
    }

    if (env?.ASSETS) {
      return env.ASSETS.fetch(request)
    }

    return new Response('Not Found', { status: 404 })
  },
}
