import { z } from 'zod'
import {
  buildExamplePrompt,
  buildMnemonicPrompt,
  cleanAiOutput,
  formatMnemonicResult,
} from '../infrastructure/ai/prompts'

export const aiRequestSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('example'),
    spanish: z.string().trim().min(1).max(200),
  }),
  z.object({
    type: z.literal('mnemonic'),
    spanish: z.string().trim().min(1).max(200),
    english: z.string().trim().min(1).max(200),
  }),
])

export type AiRequest = z.infer<typeof aiRequestSchema>

export interface AiWorkerEnv {
  AI?: {
    run: (
      model: string,
      input:
        | { prompt: string; max_tokens?: number }
        | {
            messages: Array<{ role: string; content: string }>
            max_tokens?: number
          },
    ) => Promise<{ response?: string } | string>
  }
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function handleAiRequest(
  request: Request,
  env?: AiWorkerEnv,
): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    })
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
        Allow: 'POST, OPTIONS',
      },
    })
  }

  let bodyText: string
  try {
    bodyText = await request.text()
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to read body' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  let rawJson: unknown
  try {
    rawJson = JSON.parse(bodyText)
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  const parsed = aiRequestSchema.safeParse(rawJson)
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: 'Invalid request body',
        details: parsed.error.issues,
      }),
      {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      },
    )
  }

  if (!env?.AI) {
    return new Response(
      JSON.stringify({ error: 'AI binding not configured' }),
      {
        status: 503,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      },
    )
  }

  const payload = parsed.data
  const prompt =
    payload.type === 'example'
      ? buildExamplePrompt(payload.spanish)
      : buildMnemonicPrompt(payload.spanish, payload.english)

  const messages = [
    {
      role: 'system',
      content:
        'You are an expert Mexican Spanish linguistic tutor. Respond concisely with exactly what was requested on a single line without preamble or extra notes.',
    },
    { role: 'user', content: prompt },
  ]

  try {
    const aiResult = await env.AI.run('@cf/meta/llama-3.1-8b-instruct-fast', {
      messages,
      max_tokens: 150,
    })

    const rawText =
      typeof aiResult === 'object' &&
      aiResult !== null &&
      'response' in aiResult &&
      typeof aiResult.response === 'string'
        ? aiResult.response
        : typeof aiResult === 'string'
          ? aiResult
          : ''

    const cleaned =
      payload.type === 'example'
        ? cleanAiOutput(rawText)
        : formatMnemonicResult(rawText)

    return new Response(JSON.stringify({ text: cleaned }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown AI error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
}
