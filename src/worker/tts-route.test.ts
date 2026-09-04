import { describe, expect, it } from 'vitest'
import { handleTtsRequest } from './tts-route'

describe('handleTtsRequest', () => {
  it('returns 400 if text query parameter is missing', async () => {
    const request = new Request('https://joli.to/api/tts')
    const response = await handleTtsRequest(request)
    expect(response.status).toBe(400)
    const json = (await response.json()) as { error?: string }
    expect(json.error).toContain('text')
  })

  it('returns 400 if text is empty or blank', async () => {
    const request = new Request('https://joli.to/api/tts?text=%20%20')
    const response = await handleTtsRequest(request)
    expect(response.status).toBe(400)
  })

  it('returns 204 for OPTIONS preflight request', async () => {
    const request = new Request('https://joli.to/api/tts?text=hola', {
      method: 'OPTIONS',
    })
    const response = await handleTtsRequest(request)
    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })

  it('returns synthesized audio with immutable caching headers on success', async () => {
    const mockSynthesize = () =>
      Promise.resolve(new Uint8Array([0xff, 0xfb, 1, 2, 3]))

    const request = new Request(
      'https://joli.to/api/tts?text=buenos+dias&locale=es-MX',
    )
    const response = await handleTtsRequest(request, {
      synthesizeFn: mockSynthesize,
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('audio/mpeg')
    expect(response.headers.get('Cache-Control')).toBe(
      'public, max-age=31536000, immutable',
    )
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')

    const body = new Uint8Array(await response.arrayBuffer())
    expect(body).toEqual(new Uint8Array([0xff, 0xfb, 1, 2, 3]))
  })

  it('passes selected voice or deterministically derived voice to synthesizeFn', async () => {
    let capturedOptions: unknown = null
    const mockSynthesize = (options: unknown) => {
      capturedOptions = options
      return Promise.resolve(new Uint8Array([1, 2, 3]))
    }

    const request = new Request(
      'https://joli.to/api/tts?text=aguacate&locale=es-MX',
    )
    await handleTtsRequest(request, { synthesizeFn: mockSynthesize })

    expect(capturedOptions).toMatchObject({
      text: 'aguacate',
      locale: 'es-MX',
    })
    expect((capturedOptions as { voice: string }).voice).toMatch(
      /es-MX-(Dalia|Jorge)Neural/,
    )
  })

  it('returns 502 if synthesizeFn fails', async () => {
    const failingSynthesize = () =>
      Promise.reject(new Error('Bing TTS unreachable'))

    const request = new Request('https://joli.to/api/tts?text=fail')
    const response = await handleTtsRequest(request, {
      synthesizeFn: failingSynthesize,
    })

    expect(response.status).toBe(502)
    const json = (await response.json()) as {
      error?: string
      details?: string
    }
    expect(json.error).toBe('Speech synthesis failed')
    expect(json.details).toContain('Bing TTS unreachable')
  })
})
