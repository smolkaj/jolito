import { handleTtsRequest } from './tts-route'

export interface WorkerEnv {
  ASSETS?: {
    fetch: (request: Request) => Promise<Response>
  }
}

export default {
  async fetch(request: Request, env?: WorkerEnv): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname.replace(/\/+$/, '') === '/api/tts') {
      return handleTtsRequest(request)
    }

    if (env?.ASSETS) {
      return env.ASSETS.fetch(request)
    }

    return new Response('Not Found', { status: 404 })
  },
}
