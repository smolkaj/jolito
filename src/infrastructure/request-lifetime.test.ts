import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { withRequestDeadline } from './request-lifetime'

describe('withRequestDeadline', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('resolves with the operation value when completed within deadline', async () => {
    let capturedSignal: AbortSignal | undefined
    const res = await withRequestDeadline((signal) => {
      capturedSignal = signal
      expect(signal.aborted).toBe(false)
      return Promise.resolve({ ok: true, data: 'test-data' })
    })

    expect(res).toEqual({ ok: true, data: 'test-data' })
    // The signal must be aborted in finally when the operation finishes
    expect(capturedSignal?.aborted).toBe(true)
  })

  it('aborts internal controller upon completion so consuming streams outside fails', async () => {
    let leakedSignal: AbortSignal | undefined

    await withRequestDeadline((signal) => {
      leakedSignal = signal
      expect(signal.aborted).toBe(false)
      return Promise.resolve('done')
    })

    expect(leakedSignal?.aborted).toBe(true)

    // Simulating what happened with response.json() outside withRequestDeadline:
    const simulateBodyRead = () => {
      if (leakedSignal?.aborted) {
        throw new TypeError('Fetch is aborted')
      }
      return { message: 'should not reach here' }
    }

    expect(() => simulateBodyRead()).toThrow('Fetch is aborted')
  })

  it('times out and rejects with clear copy when operation exceeds 10s', async () => {
    vi.useFakeTimers()

    const pendingOp = withRequestDeadline(async () => {
      await new Promise(() => {}) // never resolves
      return 'unreachable'
    })

    const expectation = expect(pendingOp).rejects.toThrow(
      'Request timed out. Please try again.',
    )

    await vi.advanceTimersByTimeAsync(10_000)
    await expectation
  })

  it('rejects with clear interrupt copy when parentSignal is already aborted', async () => {
    const parent = new AbortController()
    parent.abort()

    await expect(
      withRequestDeadline(() => Promise.resolve('ok'), parent.signal),
    ).rejects.toThrow('Request was interrupted. Please try again.')
  })

  it('rejects with clear interrupt copy when parentSignal aborts during operation', async () => {
    const parent = new AbortController()

    const pending = withRequestDeadline(async () => {
      await new Promise((resolve) => setTimeout(resolve, 500))
      return 'ok'
    }, parent.signal)

    setTimeout(() => {
      parent.abort()
    }, 10)

    await expect(pending).rejects.toThrow(
      'Request was interrupted. Please try again.',
    )
  })
})
