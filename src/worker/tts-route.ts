import { z } from 'zod'
import { readJsonBody, RequestBodyError } from './request-body.ts'
import { synthesizeSpeech } from '../infrastructure/tts/synthesize.ts'
import {
  getDeterministicVoice,
  isValidVoice,
  normalizeLocale,
} from '../infrastructure/tts/voices.ts'

export const ttsQuerySchema = z.object({
  text: z
    .string({ message: 'Missing required query parameter "text"' })
    .trim()
    .min(1, 'Missing required query parameter "text"')
    .max(500, 'Text parameter too long (max 500 characters)'),
  locale: z
    .string()
    .trim()
    .refine(
      (val) => {
        const norm = val.toLowerCase().replace(/_/g, '-')
        return (
          norm === 'es-mx' || norm === 'en-us' || norm === 'es' || norm === 'en'
        )
      },
      { message: 'Unsupported locale. Supported locales: es-MX, en-US' },
    )
    .transform(normalizeLocale)
    .default('es-MX'),
  voice: z
    .string()
    .trim()
    .refine((v) => isValidVoice(v), {
      message:
        'Invalid voice parameter. Supported voices: es-MX-DaliaNeural, es-MX-JorgeNeural, en-US-JennyNeural, en-US-GuyNeural',
    })
    .optional(),
})

export interface TtsRouteDependencies {
  synthesizeFn?: typeof synthesizeSpeech
}

export async function handleTtsRequest(
  request: Request,
  deps?: TtsRouteDependencies,
): Promise<Response> {
  const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    })
  }

  if (request.method !== 'GET' && request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        ...corsHeaders,
        Allow: 'GET, POST, OPTIONS',
        'Content-Type': 'application/json',
      },
    })
  }

  const url = new URL(request.url)
  let input: unknown = {
    text: url.searchParams.get('text') ?? undefined,
    locale: url.searchParams.get('locale') ?? undefined,
    voice: url.searchParams.get('voice') ?? undefined,
  }
  if (request.method === 'POST') {
    try {
      input = await readJsonBody(request, 4096)
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : 'Invalid request.' },
        {
          status: error instanceof RequestBodyError ? error.status : 400,
          headers: corsHeaders,
        },
      )
    }
  }
  const parsed = ttsQuerySchema.safeParse(input)

  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: parsed.error.issues[0]?.message ?? 'Invalid query parameters',
        issues: parsed.error.issues,
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    )
  }

  const { text, locale, voice: requestedVoice } = parsed.data
  const voice = requestedVoice ?? getDeterministicVoice(text, locale)

  const synthesize = deps?.synthesizeFn ?? synthesizeSpeech

  try {
    const audioBytes = await synthesize({
      text,
      locale,
      voice,
      timeoutMs: 8000,
    })

    const body = new Uint8Array(audioBytes).buffer

    const response = new Response(body, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audioBytes.byteLength),
        'Cache-Control': 'private, no-store',
      },
    })

    return response
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(
      JSON.stringify({
        error: 'Speech synthesis failed',
        details: message,
      }),
      {
        status: 502,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    )
  }
}
