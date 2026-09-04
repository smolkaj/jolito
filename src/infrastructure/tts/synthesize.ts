import {
  buildConfigMessage,
  buildSsml,
  buildSsmlMessage,
  buildWssHeaders,
  buildWssUrl,
  generateConnectionId,
  generateSecMsGec,
  parseBinaryAudioFrame,
} from './protocol.ts'
import { getDeterministicVoice, isValidVoice } from './voices.ts'

export interface SynthesizeOptions {
  text: string
  voice?: string
  locale?: string
  timeoutMs?: number
  wsFactory?: (
    url: string,
    headers: Record<string, string>,
  ) => Promise<EdgeWebSocketLike>
}

export interface EdgeWebSocketLike {
  send(data: string | ArrayBuffer | Uint8Array): void
  close(): void
  readyState?: number
  onopen?: ((event: unknown) => void) | null
  onmessage?: ((event: { data: unknown }) => void) | null
  onerror?: ((event: unknown) => void) | null
  onclose?: ((event: { code: number; reason: string }) => void) | null
  addEventListener?(type: string, listener: (event: unknown) => void): void
}

/**
 * Creates an outbound WebSocket connection across Cloudflare Workers and Node environments.
 */
export async function defaultWsFactory(
  url: string,
  headers: Record<string, string>,
): Promise<EdgeWebSocketLike> {
  // 1. Cloudflare Workers environment: fetch with Upgrade: websocket
  if (
    typeof fetch === 'function' &&
    typeof (globalThis as unknown as { WebSocketPair?: unknown })
      .WebSocketPair !== 'undefined'
  ) {
    const httpUrl = url.replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:')
    const resp = await fetch(httpUrl, {
      headers: {
        Upgrade: 'websocket',
        ...headers,
      },
    })
    const ws = (resp as unknown as { webSocket?: unknown }).webSocket as
      (EdgeWebSocketLike & { accept?: () => void }) | undefined
    if (ws) {
      if (typeof ws.accept === 'function') {
        ws.accept()
      }
      return ws
    }
    throw new Error(
      `WebSocket upgrade failed with HTTP ${resp.status} ${resp.statusText}`,
    )
  }

  // 2. Node.js environment: use undici WebSocket which allows custom headers (Origin, etc.)
  try {
    const undici = await import('undici')
    const NodeWs = undici.WebSocket
    const ws = new NodeWs(url, { headers })
    ws.binaryType = 'arraybuffer'
    return ws as unknown as EdgeWebSocketLike
  } catch {
    // If undici is not available, try standard WebSocket
    if (typeof WebSocket !== 'undefined') {
      const ws = new WebSocket(url)
      ws.binaryType = 'arraybuffer'
      return ws as unknown as EdgeWebSocketLike
    }
    throw new Error('No supported WebSocket implementation found')
  }
}

/**
 * Synthesizes text into MP3 audio bytes using the Edge TTS service.
 */
export async function synthesizeSpeech(
  options: SynthesizeOptions,
): Promise<Uint8Array> {
  const {
    text,
    locale = 'es-MX',
    timeoutMs = 10000,
    wsFactory = defaultWsFactory,
  } = options

  const cleanText = text.trim()
  if (!cleanText) {
    throw new Error('Synthesis text cannot be empty')
  }

  const voice =
    options.voice && isValidVoice(options.voice)
      ? options.voice
      : getDeterministicVoice(cleanText, locale)

  const connectionId = generateConnectionId()
  const secMsGec = await generateSecMsGec()
  const url = buildWssUrl(secMsGec, connectionId)
  const headers = buildWssHeaders()

  const ws = await wsFactory(url, headers)

  return new Promise<Uint8Array>((resolve, reject) => {
    const audioChunks: Uint8Array[] = []
    let isSettled = false

    const timer = setTimeout(() => {
      cleanup()
      reject(new Error(`Edge TTS synthesis timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    function cleanup() {
      if (isSettled) return
      isSettled = true
      clearTimeout(timer)
      try {
        ws.close()
      } catch {
        // Ignore close errors
      }
    }

    function finish() {
      cleanup()
      if (audioChunks.length === 0) {
        reject(new Error('No audio received from Edge TTS service'))
        return
      }
      const totalLen = audioChunks.reduce((acc, chunk) => acc + chunk.length, 0)
      const combined = new Uint8Array(totalLen)
      let offset = 0
      for (const chunk of audioChunks) {
        combined.set(chunk, offset)
        offset += chunk.length
      }
      resolve(combined)
    }

    let handshakeSent = false
    function sendHandshake() {
      if (handshakeSent) return
      handshakeSent = true
      try {
        // 1. Send speech.config
        ws.send(buildConfigMessage())

        // 2. Send SSML request
        const ssml = buildSsml(cleanText, voice, locale)
        const requestId = generateConnectionId()
        ws.send(buildSsmlMessage(requestId, ssml))
      } catch (err) {
        cleanup()
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    }

    const onOpen = () => {
      sendHandshake()
    }

    const onMessage = (event: unknown) => {
      const data =
        event !== null && typeof event === 'object' && 'data' in event
          ? event.data
          : event
      if (typeof data === 'string') {
        if (data.includes('Path:turn.end')) {
          finish()
        }
      } else if (data instanceof ArrayBuffer) {
        const { isAudio, audioData } = parseBinaryAudioFrame(data)
        if (isAudio && audioData.length > 0) {
          audioChunks.push(new Uint8Array(audioData))
        }
      } else if (ArrayBuffer.isView(data)) {
        const viewBytes = new Uint8Array(
          data.buffer,
          data.byteOffset,
          data.byteLength,
        )
        const { isAudio, audioData } = parseBinaryAudioFrame(viewBytes)
        if (isAudio && audioData.length > 0) {
          audioChunks.push(new Uint8Array(audioData))
        }
      }
    }

    const onError = (err: unknown) => {
      cleanup()
      reject(
        err instanceof Error
          ? err
          : new Error(`WebSocket error: ${String(err)}`),
      )
    }

    const onClose = (event: unknown) => {
      if (audioChunks.length > 0) {
        finish()
      } else if (!isSettled) {
        const closeEvt = event as { code?: number; reason?: string }
        cleanup()
        reject(
          new Error(
            `WebSocket closed without audio (code=${closeEvt?.code ?? 'unknown'}, reason=${closeEvt?.reason || 'none'})`,
          ),
        )
      }
    }

    if ('onmessage' in ws) {
      ws.onopen = onOpen
      ws.onmessage = onMessage
      ws.onerror = onError
      ws.onclose = onClose
    } else if (typeof ws.addEventListener === 'function') {
      ws.addEventListener('open', onOpen)
      ws.addEventListener('message', onMessage)
      ws.addEventListener('error', onError)
      ws.addEventListener('close', onClose)
    }

    if (ws.readyState === 1) {
      sendHandshake()
    }
  })
}
