import { describe, expect, it } from 'vitest'
import type { EdgeWebSocketLike } from './synthesize'
import { synthesizeSpeech } from './synthesize'

class MockEdgeWebSocket implements EdgeWebSocketLike {
  sentMessages: Array<string | ArrayBuffer | Uint8Array> = []
  readyState = 0 // CONNECTING
  private listeners: Record<string, Array<(event: unknown) => void>> = {}

  send(data: string | ArrayBuffer | Uint8Array): void {
    this.sentMessages.push(data)
  }

  close(): void {
    this.readyState = 3 // CLOSED
  }

  addEventListener(type: string, listener: (event: unknown) => void): void {
    if (!this.listeners[type]) {
      this.listeners[type] = []
    }
    this.listeners[type].push(listener)
  }

  emit(type: string, event: unknown = {}): void {
    for (const cb of this.listeners[type] ?? []) {
      cb(event)
    }
  }

  simulateOpen(): void {
    this.readyState = 1 // OPEN
    this.emit('open', {})
  }

  simulateAudioChunk(payload: Uint8Array): void {
    const headerStr = 'Path:audio\r\n'
    const headerBytes = new TextEncoder().encode(headerStr)
    const frame = new Uint8Array(2 + headerBytes.length + payload.length)
    frame[0] = (headerBytes.length >> 8) & 0xff
    frame[1] = headerBytes.length & 0xff
    frame.set(headerBytes, 2)
    frame.set(payload, 2 + headerBytes.length)
    this.emit('message', { data: frame.buffer })
  }

  simulateTurnEnd(): void {
    this.emit('message', { data: 'Path:turn.end\r\n' })
  }
}

function createMockEnvironment(initialReadyState = 0) {
  const mockWs = new MockEdgeWebSocket()
  mockWs.readyState = initialReadyState

  let notifyReady!: () => void
  const attachedPromise = new Promise<void>((resolve) => {
    notifyReady = resolve
  })

  const wsFactory = () => {
    // Return mock socket, then wait for listeners to be attached on the next tick
    setTimeout(() => notifyReady(), 0)
    return Promise.resolve(mockWs)
  }

  return { mockWs, wsFactory, attachedPromise }
}

describe('synthesizeSpeech', () => {
  it('throws error when text is empty', async () => {
    await expect(synthesizeSpeech({ text: '   ' })).rejects.toThrow(
      'Synthesis text cannot be empty',
    )
  })

  it('completes synthesis lifecycle with audio chunks and turn.end', async () => {
    const { mockWs, wsFactory, attachedPromise } = createMockEnvironment()

    const promise = synthesizeSpeech({
      text: 'Buenos días',
      locale: 'es-MX',
      timeoutMs: 1000,
      wsFactory,
    })

    await attachedPromise

    // Simulate open
    mockWs.simulateOpen()

    // Verify speech.config and SSML were sent
    expect(mockWs.sentMessages.length).toBe(2)
    expect(typeof mockWs.sentMessages[0]).toBe('string')
    expect(mockWs.sentMessages[0] as string).toContain('Path:speech.config')
    expect(mockWs.sentMessages[1] as string).toContain('Path:ssml')
    expect(mockWs.sentMessages[1] as string).toContain('Buenos días')

    // Simulate receiving audio chunks
    const chunk1 = new Uint8Array([1, 2, 3])
    const chunk2 = new Uint8Array([4, 5, 6, 7])
    mockWs.simulateAudioChunk(chunk1)
    mockWs.simulateAudioChunk(chunk2)

    // Simulate turn.end
    mockWs.simulateTurnEnd()

    const result = await promise
    expect(result).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6, 7]))
  })

  it('handles immediate open readyState (Cloudflare worker style)', async () => {
    const { mockWs, wsFactory, attachedPromise } = createMockEnvironment(1) // OPEN

    const promise = synthesizeSpeech({
      text: 'Hola',
      timeoutMs: 1000,
      wsFactory,
    })

    await attachedPromise

    expect(mockWs.sentMessages.length).toBe(2)

    mockWs.simulateAudioChunk(new Uint8Array([99]))
    mockWs.simulateTurnEnd()

    const result = await promise
    expect(result).toEqual(new Uint8Array([99]))
  })

  it('rejects on WebSocket error', async () => {
    const { mockWs, wsFactory, attachedPromise } = createMockEnvironment()

    const promise = synthesizeSpeech({
      text: 'Test error',
      timeoutMs: 1000,
      wsFactory,
    })

    await attachedPromise
    mockWs.simulateOpen()
    mockWs.emit('error', new Error('Connection refused'))

    await expect(promise).rejects.toThrow('Connection refused')
  })

  it('rejects when closed without audio', async () => {
    const { mockWs, wsFactory, attachedPromise } = createMockEnvironment()

    const promise = synthesizeSpeech({
      text: 'Test close',
      timeoutMs: 1000,
      wsFactory,
    })

    await attachedPromise
    mockWs.simulateOpen()
    mockWs.emit('close', { code: 1006, reason: 'Abrupt close' })

    await expect(promise).rejects.toThrow('WebSocket closed without audio')
  })

  it('rejects on timeout', async () => {
    const { wsFactory, attachedPromise } = createMockEnvironment()

    const promise = synthesizeSpeech({
      text: 'Timeout test',
      timeoutMs: 50,
      wsFactory,
    })

    await attachedPromise

    await expect(promise).rejects.toThrow('timed out after 50ms')
  })
})
