import { describe, expect, it, vi } from 'vitest'
import { checkOrRequestStoragePersistence } from './storage-persistence'

describe('checkOrRequestStoragePersistence', () => {
  it('returns true when storage is already persisted', async () => {
    const originalStorage = navigator.storage
    Object.defineProperty(navigator, 'storage', {
      value: {
        persisted: vi.fn().mockResolvedValue(true),
        persist: vi.fn().mockResolvedValue(true),
      },
      configurable: true,
    })

    const result = await checkOrRequestStoragePersistence()
    expect(result).toBe(true)

    Object.defineProperty(navigator, 'storage', {
      value: originalStorage,
      configurable: true,
    })
  })

  it('requests persistence when storage is not yet persisted', async () => {
    const originalStorage = navigator.storage
    const persistMock = vi.fn().mockResolvedValue(true)
    Object.defineProperty(navigator, 'storage', {
      value: {
        persisted: vi.fn().mockResolvedValue(false),
        persist: persistMock,
      },
      configurable: true,
    })

    const result = await checkOrRequestStoragePersistence()
    expect(result).toBe(true)
    expect(persistMock).toHaveBeenCalled()

    Object.defineProperty(navigator, 'storage', {
      value: originalStorage,
      configurable: true,
    })
  })

  it('returns false when storage persistence fails or throws', async () => {
    const originalStorage = navigator.storage
    Object.defineProperty(navigator, 'storage', {
      value: {
        persisted: vi.fn().mockRejectedValue(new Error('Permission denied')),
      },
      configurable: true,
    })

    const result = await checkOrRequestStoragePersistence()
    expect(result).toBe(false)

    Object.defineProperty(navigator, 'storage', {
      value: originalStorage,
      configurable: true,
    })
  })

  it('returns false when storage object lacks persisted/persist methods', async () => {
    const originalStorage = navigator.storage
    Object.defineProperty(navigator, 'storage', {
      value: {},
      configurable: true,
    })

    const result = await checkOrRequestStoragePersistence()
    expect(result).toBe(false)

    Object.defineProperty(navigator, 'storage', {
      value: originalStorage,
      configurable: true,
    })
  })

  it('returns false when navigator.storage is unavailable', async () => {
    const originalStorage = navigator.storage
    Object.defineProperty(navigator, 'storage', {
      value: undefined,
      configurable: true,
    })

    const result = await checkOrRequestStoragePersistence()
    expect(result).toBe(false)

    Object.defineProperty(navigator, 'storage', {
      value: originalStorage,
      configurable: true,
    })
  })
})
