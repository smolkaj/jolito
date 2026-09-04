import { describe, expect, it } from 'vitest'
import {
  buildConfigMessage,
  buildSsml,
  buildSsmlMessage,
  buildWssHeaders,
  buildWssUrl,
  escapeXml,
  generateConnectionId,
  generateMuid,
  generateSecMsGec,
  parseBinaryAudioFrame,
} from './protocol'

describe('protocol', () => {
  it('escapes XML special characters in SSML text', () => {
    expect(escapeXml('¿Cómo estás?')).toBe('¿Cómo estás?')
    expect(escapeXml('Tom & Jerry <friends> "quotes" \'apostrophe\'')).toBe(
      'Tom &amp; Jerry &lt;friends&gt; &quot;quotes&quot; &apos;apostrophe&apos;',
    )
  })

  it('builds valid SSML matching Microsoft synthesis specification', () => {
    const ssml = buildSsml('Hola mundo', 'es-MX-DaliaNeural', 'es-MX')
    expect(ssml).toContain("<speak version='1.0'")
    expect(ssml).toContain("xmlns='http://www.w3.org/2001/10/synthesis'")
    expect(ssml).toContain("xml:lang='es-MX'")
    expect(ssml).toContain("<voice name='es-MX-DaliaNeural'>")
    expect(ssml).toContain(
      "<prosody pitch='+0Hz' rate='+0%'>Hola mundo</prosody>",
    )
  })

  it('escapes XML special characters in voice and locale attributes to prevent SSML injection', () => {
    const ssml = buildSsml('hello', "voice' <inject>", "es' <bad>")
    expect(ssml).toContain("xml:lang='es&apos; &lt;bad&gt;'")
    expect(ssml).toContain("<voice name='voice&apos; &lt;inject&gt;'>")
  })

  it('generates consistent Sec-MS-GEC token for fixed timestamp', async () => {
    // 1700000000 -> Nov 14, 2023
    const token1 = await generateSecMsGec(1700000000)
    const token2 = await generateSecMsGec(1700000000)
    expect(token1).toBe(token2)
    expect(token1).toHaveLength(64) // SHA-256 hex string
    expect(token1).toMatch(/^[0-9A-F]{64}$/)
  })

  it('generates non-empty connection IDs and muid strings', () => {
    const connId1 = generateConnectionId()
    const connId2 = generateConnectionId()
    expect(connId1).toHaveLength(32)
    expect(connId2).toHaveLength(32)
    expect(connId1).not.toBe(connId2)

    const muid1 = generateMuid()
    const muid2 = generateMuid()
    expect(muid1).toHaveLength(32)
    expect(muid1).not.toBe(muid2)
  })

  it('constructs correct WSS URL with parameters', () => {
    const url = buildWssUrl('ABCDEF123456', 'conn-uuid-123')
    expect(url).toContain(
      'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1',
    )
    expect(url).toContain('TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4')
    expect(url).toContain('Sec-MS-GEC=ABCDEF123456')
    expect(url).toContain('Sec-MS-GEC-Version=1-143.0.3650.75')
    expect(url).toContain('ConnectionId=conn-uuid-123')
  })

  it('builds headers required for Edge TTS handshake', () => {
    const headers = buildWssHeaders('MUID1234')
    expect(headers['Origin']).toBe(
      'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
    )
    expect(headers['Pragma']).toBe('no-cache')
    expect(headers['Cookie']).toBe('muid=MUID1234;')
    expect(headers['User-Agent']).toContain('Edg/143.0.0.0')
  })

  it('builds config and SSML websocket messages', () => {
    const configMsg = buildConfigMessage('2026-09-04T00:00:00.000Z')
    expect(configMsg).toContain('Path:speech.config\r\n')
    expect(configMsg).toContain(
      'outputFormat":"audio-24khz-48kbitrate-mono-mp3',
    )

    const ssmlMsg = buildSsmlMessage(
      'req-1',
      '<speak>hi</speak>',
      '2026-09-04T00:00:00.000Z',
    )
    expect(ssmlMsg).toContain('X-RequestId:req-1\r\n')
    expect(ssmlMsg).toContain('Path:ssml\r\n')
    expect(ssmlMsg).toContain('<speak>hi</speak>')
  })

  it('parses binary audio frame correctly', () => {
    // Header string
    const headerStr = 'X-RequestId:req-1\r\nPath:audio\r\n\r\n'
    const headerBytes = new TextEncoder().encode(headerStr)
    const headerLen = headerBytes.length

    // Simulated MP3 payload
    const audioPayload = new Uint8Array([0xff, 0xfb, 0x90, 0x44, 0x00, 0x11])

    // Frame: 2 bytes BigEndian length + headerBytes + audioPayload
    const frame = new Uint8Array(2 + headerLen + audioPayload.length)
    frame[0] = (headerLen >> 8) & 0xff
    frame[1] = headerLen & 0xff
    frame.set(headerBytes, 2)
    frame.set(audioPayload, 2 + headerLen)

    const parsed = parseBinaryAudioFrame(frame.buffer)
    expect(parsed.isAudio).toBe(true)
    expect(parsed.audioData).toEqual(audioPayload)
  })

  it('ignores non-audio binary frames', () => {
    const headerStr = 'X-RequestId:req-1\r\nPath:other\r\n\r\n'
    const headerBytes = new TextEncoder().encode(headerStr)
    const headerLen = headerBytes.length
    const frame = new Uint8Array(2 + headerLen)
    frame[0] = (headerLen >> 8) & 0xff
    frame[1] = headerLen & 0xff
    frame.set(headerBytes, 2)

    const parsed = parseBinaryAudioFrame(frame.buffer)
    expect(parsed.isAudio).toBe(false)
    expect(parsed.audioData.length).toBe(0)
  })

  it('handles malformed or truncated binary frames safely', () => {
    const truncatedFrame = new Uint8Array([0x00])
    const parsed = parseBinaryAudioFrame(truncatedFrame.buffer)
    expect(parsed.isAudio).toBe(false)
    expect(parsed.audioData.length).toBe(0)
  })
})
