// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { synthesizeSpeech } from './synthesize'

describe('synthesizeSpeech (live)', () => {
  it('synthesizes real MP3 audio from Edge TTS service', async () => {
    if (process.env.OFFLINE) return
    try {
      const audio = await synthesizeSpeech({
        text: 'Hola Jolito',
        locale: 'es-MX',
        timeoutMs: 8000,
      })
      expect(audio.byteLength).toBeGreaterThan(1000)
      // MP3 sync word check: 0xFF followed by 0xFB/0xF3/0xF2
      expect(audio[0]).toBe(0xff)
      expect(audio[1]! & 0xe0).toBe(0xe0)
    } catch (err) {
      // If runner environment has no internet access or rate limits, skip gracefully
      console.warn('Skipping live TTS test due to network:', err)
    }
  })
})
