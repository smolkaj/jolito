import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Capacitor } from '@capacitor/core'
import { PracticeActivityBridge } from './native-live-activity'

describe('PracticeActivityBridge (Dynamic Island Live Activity)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('no-ops safely on web / non-native platforms', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false)
    const bridge = new PracticeActivityBridge()

    expect(bridge.isSupported()).toBe(false)
    await bridge.start({ total: 10, title: 'Test Session' })
    await bridge.update({ completed: 1, remaining: 9 })
    await bridge.end()
    // Should complete without error
  })

  it('no-ops safely on non-iOS native platforms (e.g. Android)', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android')
    const bridge = new PracticeActivityBridge()

    expect(bridge.isSupported()).toBe(false)
    await bridge.start({ total: 5 })
    await bridge.update({ completed: 2, remaining: 3 })
    await bridge.end()
  })

  it('reports supported on native iOS platform', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('ios')
    const bridge = new PracticeActivityBridge()

    expect(bridge.isSupported()).toBe(true)
  })
})
