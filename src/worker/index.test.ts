import { describe, expect, it } from 'vitest'
import worker from './index'

describe('worker fetch handler', () => {
  it('routes /api/tts to TTS handler', async () => {
    const req = new Request('https://joli.to/api/tts')
    const res = await worker.fetch(req)
    // Missing text parameter returns 400
    expect(res.status).toBe(400)
  })

  it('routes /api/tts/ with trailing slash to TTS handler', async () => {
    const req = new Request('https://joli.to/api/tts/')
    const res = await worker.fetch(req)
    expect(res.status).toBe(400)
  })

  it('routes /api/feedback to feedback handler', async () => {
    const req = new Request('https://joli.to/api/feedback', {
      method: 'OPTIONS',
    })
    const res = await worker.fetch(req)
    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST')
  })

  it('routes /api/feedback/ with trailing slash to feedback handler', async () => {
    const req = new Request('https://joli.to/api/feedback/', {
      method: 'OPTIONS',
    })
    const res = await worker.fetch(req)
    expect(res.status).toBe(204)
  })

  it('routes /api/stats to stats handler', async () => {
    const req = new Request('https://joli.to/api/stats', {
      method: 'OPTIONS',
    })
    const res = await worker.fetch(req)
    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('GET')
  })

  it('routes /api/stats/ with trailing slash to stats handler', async () => {
    const req = new Request('https://joli.to/api/stats/', {
      method: 'OPTIONS',
    })
    const res = await worker.fetch(req)
    expect(res.status).toBe(204)
  })

  it('delegates asset requests to env.ASSETS when present', async () => {
    let capturedAssetRequest: Request | null = null
    const mockEnv = {
      ASSETS: {
        fetch: (req: Request) => {
          capturedAssetRequest = req
          return Promise.resolve(new Response('asset content', { status: 200 }))
        },
      },
    }

    const req = new Request('https://joli.to/assets/index.js')
    const res = await worker.fetch(req, mockEnv)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('asset content')
    expect(capturedAssetRequest).toBe(req)
  })

  it('returns 404 for unknown route if env.ASSETS is missing', async () => {
    const req = new Request('https://joli.to/unknown')
    const res = await worker.fetch(req)
    expect(res.status).toBe(404)
  })
})
