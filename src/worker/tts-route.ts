import { z } from 'zod'
import { synthesizeSpeech } from '../infrastructure/tts/synthesize.ts'
import {
  getDeterministicVoice,
  isValidVoice,
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
        const clean = val.toLowerCase().replace(/_/g, '-')
        return clean.startsWith('es') || clean.startsWith('en')
      },
      { message: 'Unsupported locale. Supported locales: es-MX, en-US' },
    )
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

  const edgeCache =
    typeof caches !== 'undefined' && 'default' in caches
      ? (caches as unknown as { default: Cache }).default
      : null

  if (edgeCache) {
    try {
      const cached = await edgeCache.match(request)
      if (cached) {
        return cached
      }
    } catch {
      // Ignore cache lookup errors
    }
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
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })

    if (edgeCache) {
      try {
        await edgeCache.put(request, response.clone())
      } catch {
        // Ignore cache storage errors
      }
    }

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
