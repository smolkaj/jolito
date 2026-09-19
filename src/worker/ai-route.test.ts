import { describe, expect, it, vi } from 'vitest'
import { handleAiRequest, type AiWorkerEnv } from './ai-route'

describe('handleAiRequest', () => {
  it('handles OPTIONS preflight with CORS headers', async () => {
    const request = new Request('https://joli.to/api/ai', {
      method: 'OPTIONS',
    })
    const response = await handleAiRequest(request)
    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain(
      'POST',
    )
  })

  it('rejects non-POST non-OPTIONS methods with 405', async () => {
    const request = new Request('https://joli.to/api/ai', {
      method: 'GET',
    })
    const response = await handleAiRequest(request)
    expect(response.status).toBe(405)
  })

  it('rejects invalid JSON with 400', async () => {
    const request = new Request('https://joli.to/api/ai', {
      method: 'POST',
      body: 'invalid-json',
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await handleAiRequest(request)
    expect(response.status).toBe(400)
  })

  it('rejects schema violations with 400', async () => {
    const request = new Request('https://joli.to/api/ai', {
      method: 'POST',
      body: JSON.stringify({ type: 'example' }), // missing spanish
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await handleAiRequest(request)
    expect(response.status).toBe(400)
  })

  it('returns 503 if AI binding is not configured in env', async () => {
    const request = new Request('https://joli.to/api/ai', {
      method: 'POST',
      body: JSON.stringify({ type: 'example', spanish: 'o sea' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await handleAiRequest(request, {})
    expect(response.status).toBe(503)
  })

  it('generates example sentence using env.AI', async () => {
    const mockAiRun = vi.fn().mockImplementation(() =>
      Promise.resolve({
        response:
          '¿Vienes o qué? — O sea, sí. (Are you coming or what? — I mean, yes.)',
      }),
    )
    const env: AiWorkerEnv = {
      AI: { run: mockAiRun },
    }
    const request = new Request('https://joli.to/api/ai', {
      method: 'POST',
      body: JSON.stringify({ type: 'example', spanish: 'o sea' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await handleAiRequest(request, env)
    expect(response.status).toBe(200)
    const json = (await response.json()) as { text: string }
    expect(json.text).toBe(
      '¿Vienes o qué? — O sea, sí. (Are you coming or what? — I mean, yes.)',
    )
    const prompt =
      'Give me an authentic, characteristic, but simple and short Mexican Spanish example sentence using "o sea" with an English translation in parentheses. If "o sea" is a phrasal verb, idiomatic expression, or includes a preposition (such as "dar a", "tratar de", etc.), keep the preposition or its grammatical contraction (e.g. "al") intact in the sentence to preserve this exact meaning rather than reverting to the base verb. Keep all other words in the sentence strictly to very basic, common everyday vocabulary (A1–A2 level) so it is easy for a beginner learner to understand. Output ONLY the Spanish sentence and English translation in parentheses on a single line without any preamble or conversational filler.'
    expect(mockAiRun).toHaveBeenCalledWith(
      '@cf/meta/llama-3.1-8b-instruct-fast',
      {
        messages: [
          {
            role: 'system',
            content:
              'You are an expert Mexican Spanish linguistic tutor. Respond concisely with exactly what was requested on a single line without preamble or extra notes.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 150,
      },
    )
  })

  it('generates example sentence anchored to english meaning and phrasal prepositions', async () => {
    const mockAiRun = vi.fn().mockImplementation(() =>
      Promise.resolve({
        response:
          'La ventana de mi cuarto da a la calle. (My room’s window faces the street.)',
      }),
    )
    const env: AiWorkerEnv = {
      AI: { run: mockAiRun },
    }
    const request = new Request('https://joli.to/api/ai', {
      method: 'POST',
      body: JSON.stringify({
        type: 'example',
        spanish: 'dar a',
        english: 'to face',
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await handleAiRequest(request, env)
    expect(response.status).toBe(200)
    const json = (await response.json()) as { text: string }
    expect(json.text).toBe(
      'La ventana de mi cuarto da a la calle. (My room’s window faces the street.)',
    )
    const expectedPrompt =
      'Give me an authentic, characteristic, but simple and short Mexican Spanish example sentence using "dar a" with the intended meaning "to face" with an English translation in parentheses. If "dar a" is a phrasal verb, idiomatic expression, or includes a preposition (such as "dar a", "tratar de", etc.), keep the preposition or its grammatical contraction (e.g. "al") intact in the sentence to preserve this exact meaning rather than reverting to the base verb. Keep all other words in the sentence strictly to very basic, common everyday vocabulary (A1–A2 level) so it is easy for a beginner learner to understand. Output ONLY the Spanish sentence and English translation in parentheses on a single line without any preamble or conversational filler.'
    expect(mockAiRun).toHaveBeenCalledWith(
      '@cf/meta/llama-3.1-8b-instruct-fast',
      {
        messages: [
          {
            role: 'system',
            content:
              'You are an expert Mexican Spanish linguistic tutor. Respond concisely with exactly what was requested on a single line without preamble or extra notes.',
          },
          {
            role: 'user',
            content: expectedPrompt,
          },
        ],
        max_tokens: 150,
      },
    )
  })

  it('generates mnemonic formatted with 💡 prefix', async () => {
    const mockAiRun = vi.fn().mockImplementation(() =>
      Promise.resolve({
        response: 'Picture a loud alter voice.',
      }),
    )
    const env: AiWorkerEnv = {
      AI: { run: mockAiRun },
    }
    const request = new Request('https://joli.to/api/ai', {
      method: 'POST',
      body: JSON.stringify({
        type: 'mnemonic',
        spanish: 'en voz alta',
        english: 'out loud',
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await handleAiRequest(request, env)
    expect(response.status).toBe(200)
    const json = (await response.json()) as { text: string }
    expect(json.text).toBe('💡 Mnemonic: Picture a loud alter voice.')
    expect(mockAiRun).toHaveBeenCalledWith(
      '@cf/meta/llama-3.1-8b-instruct-fast',
      {
        messages: [
          {
            role: 'system',
            content:
              'You are an expert Mexican Spanish linguistic tutor. Respond concisely with exactly what was requested on a single line without preamble or extra notes.',
          },
          {
            role: 'user',
            content:
              'Create a concise sound-alike mnemonic hook to remember that the Mexican Spanish phrase "en voz alta" means "out loud". Connect an English word that sounds like "en voz alta" to "out loud" in a single punchy mental image under 15 words. Example: "en voz alta" sounds like "voice alter" -> picture altering your voice to speak loud. Output ONLY the 1-sentence hook on a single line without preamble or conversational filler.',
          },
        ],
        max_tokens: 150,
      },
    )
  })
})
