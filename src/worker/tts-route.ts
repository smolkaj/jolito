import { z } from 'zod'
import { synthesizeSpeech } from '../infrastructure/tts/synthesize'
import {
  getDeterministicVoice,
  isValidVoice,
} from '../infrastructure/tts/voices'

export const ttsQuerySchema = z.object({
  text: z
    .string({ message: 'Missing required query parameter "text"' })
    .trim()
    .min(1, 'Missing required query parameter "text"')
    .max(500, 'Text parameter too long (max 500 characters)'),
  locale: z.string().trim().default('es-MX'),
  voice: z.string().trim().optional(),
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
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    })
  }

  const url = new URL(request.url)
  const parsed = ttsQuerySchema.safeParse({
    text: url.searchParams.get('text') ?? undefined,
    locale: url.searchParams.get('locale') ?? undefined,
    voice: url.searchParams.get('voice') ?? undefined,
  })

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
  const voice =
    requestedVoice && isValidVoice(requestedVoice)
      ? requestedVoice
      : getDeterministicVoice(text, locale)

  const synthesize = deps?.synthesizeFn ?? synthesizeSpeech

  try {
    const audioBytes = await synthesize({
      text,
      locale,
      voice,
      timeoutMs: 8000,
    })

    const body = new Uint8Array(audioBytes).buffer

    return new Response(body, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audioBytes.byteLength),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
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
