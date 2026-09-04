export const WIN_EPOCH = 11644473600n
export const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
export const CHROMIUM_FULL_VERSION = '143.0.3650.75'
export const SEC_MS_GEC_VERSION = `1-${CHROMIUM_FULL_VERSION}`
export const WSS_BASE_URL =
  'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1'

export async function generateSecMsGec(
  timestampSeconds?: number,
): Promise<string> {
  const nowSeconds = BigInt(timestampSeconds ?? Math.floor(Date.now() / 1000))
  let ticks = nowSeconds + WIN_EPOCH
  ticks -= ticks % 300n
  ticks *= 10_000_000n
  const strToHash = `${ticks}${TRUSTED_CLIENT_TOKEN}`
  const encoded = new TextEncoder().encode(strToHash)
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

export function generateConnectionId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID().replace(/-/g, '')
  }
  // Fallback if randomUUID not present
  const bytes = new Uint8Array(16)
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.getRandomValues === 'function'
  ) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function generateMuid(): string {
  return generateConnectionId().toUpperCase()
}

export function buildWssUrl(secMsGec: string, connectionId: string): string {
  const params = new URLSearchParams({
    TrustedClientToken: TRUSTED_CLIENT_TOKEN,
    'Sec-MS-GEC': secMsGec,
    'Sec-MS-GEC-Version': SEC_MS_GEC_VERSION,
    ConnectionId: connectionId,
  })
  return `${WSS_BASE_URL}?${params.toString()}`
}

export function buildWssHeaders(muid = generateMuid()): Record<string, string> {
  return {
    Pragma: 'no-cache',
    'Cache-Control': 'no-cache',
    Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Accept-Language': 'en-US,en;q=0.9',
    Cookie: `muid=${muid};`,
  }
}

export function escapeXml(str: string): string {
  return str.replace(/[<>&"']/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '&':
        return '&amp;'
      case '"':
        return '&quot;'
      case "'":
        return '&apos;'
      default:
        return c
    }
  })
}

export function buildSsml(text: string, voice: string, locale: string): string {
  const escaped = escapeXml(text)
  return `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${locale}'><voice name='${voice}'><prosody pitch='+0Hz' rate='+0%'>${escaped}</prosody></voice></speak>`
}

export function buildConfigMessage(
  timestamp = new Date().toISOString(),
): string {
  return `X-Timestamp:${timestamp}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r\n`
}

export function buildSsmlMessage(
  requestId: string,
  ssml: string,
  timestamp = new Date().toISOString(),
): string {
  const ts = timestamp.endsWith('Z') ? timestamp : `${timestamp}Z`
  return `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${ts}\r\nPath:ssml\r\n\r\n${ssml}`
}

export function parseBinaryAudioFrame(data: ArrayBuffer | Uint8Array): {
  isAudio: boolean
  audioData: Uint8Array
} {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  if (bytes.length < 2) {
    return { isAudio: false, audioData: new Uint8Array(0) }
  }

  // First 2 bytes: Big-Endian length of ASCII header
  const headerLen = (bytes[0]! << 8) | bytes[1]!
  if (bytes.length < 2 + headerLen) {
    return { isAudio: false, audioData: new Uint8Array(0) }
  }

  const headerBytes = bytes.subarray(2, 2 + headerLen)
  const header = new TextDecoder().decode(headerBytes)

  if (header.includes('Path:audio')) {
    const audioData = bytes.subarray(2 + headerLen)
    return { isAudio: true, audioData }
  }

  return { isAudio: false, audioData: new Uint8Array(0) }
}
