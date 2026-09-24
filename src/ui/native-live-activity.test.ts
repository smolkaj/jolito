import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Capacitor } from '@capacitor/core'
import {
  PracticeActivityBridge,
  type LiveActivityPlugin,
} from './native-live-activity'

describe('PracticeActivityBridge (Dynamic Island Live Activity)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('no-ops safely on web / non-native platforms', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false)
    const startPracticeSpy = vi.fn()
    const updatePracticeSpy = vi.fn()
    const endPracticeSpy = vi.fn()
    const mockPlugin: LiveActivityPlugin = {
      startPractice: startPracticeSpy,
      updatePractice: updatePracticeSpy,
      endPractice: endPracticeSpy,
    }
    const bridge = new PracticeActivityBridge(mockPlugin)

    expect(bridge.isSupported()).toBe(false)
    expect(bridge.isActive()).toBe(false)

    await bridge.start({ total: 10, title: 'Test Session' })
    await bridge.update({ completed: 1, remaining: 9 })
    await bridge.end()

    expect(startPracticeSpy).not.toHaveBeenCalled()
    expect(updatePracticeSpy).not.toHaveBeenCalled()
    expect(endPracticeSpy).not.toHaveBeenCalled()
  })

  it('no-ops safely on non-iOS native platforms (e.g. Android)', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android')
    const startPracticeSpy = vi.fn()
    const updatePracticeSpy = vi.fn()
    const endPracticeSpy = vi.fn()
    const mockPlugin: LiveActivityPlugin = {
      startPractice: startPracticeSpy,
      updatePractice: updatePracticeSpy,
      endPractice: endPracticeSpy,
    }
    const bridge = new PracticeActivityBridge(mockPlugin)

    expect(bridge.isSupported()).toBe(false)
    expect(bridge.isActive()).toBe(false)

    await bridge.start({ total: 5 })
    await bridge.update({ completed: 2, remaining: 3 })
    await bridge.end()

    expect(startPracticeSpy).not.toHaveBeenCalled()
  })

  it('reports supported on native iOS platform and manages activity lifecycle', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('ios')

    const startPracticeSpy = vi
      .fn()
      .mockResolvedValue({ supported: true, started: true, id: 'act-123' })
    const updatePracticeSpy = vi
      .fn()
      .mockResolvedValue({ supported: true, updated: true })
    const endPracticeSpy = vi
      .fn()
      .mockResolvedValue({ supported: true, ended: true })

    const mockPlugin: LiveActivityPlugin = {
      startPractice: startPracticeSpy,
      updatePractice: updatePracticeSpy,
      endPractice: endPracticeSpy,
    }
    const bridge = new PracticeActivityBridge(mockPlugin)

    expect(bridge.isSupported()).toBe(true)
    expect(bridge.isActive()).toBe(false)

    // 1. Start
    await bridge.start({
      total: 10,
      prompt: 'Hola',
      title: 'Card Practice',
      deepLinkUrl: 'jolito://practice/cards',
    })
    expect(startPracticeSpy).toHaveBeenCalledWith({
      total: 10,
      prompt: 'Hola',
      title: 'Card Practice',
      deepLinkUrl: 'jolito://practice/cards',
    })
    expect(bridge.isActive()).toBe(true)

    // 2. Duplicate start is ignored while active
    await bridge.start({ total: 10, prompt: 'Duplicate' })
    expect(startPracticeSpy).toHaveBeenCalledTimes(1)

    // 3. Update
    await bridge.update({
      completed: 3,
      remaining: 7,
      total: 10,
      percentage: 30,
      prompt: 'Gracias',
    })
    expect(updatePracticeSpy).toHaveBeenCalledWith({
      completed: 3,
      remaining: 7,
      total: 10,
      percentage: 30,
      prompt: 'Gracias',
    })

    // 4. End
    await bridge.end()
    expect(endPracticeSpy).toHaveBeenCalledTimes(1)
    expect(bridge.isActive()).toBe(false)

    // 5. Subsequent update after end is ignored
    await bridge.update({ completed: 4, remaining: 6 })
    expect(updatePracticeSpy).toHaveBeenCalledTimes(1)
  })

  it('awaits pending start before executing concurrent update and end without races', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('ios')

    let resolveStart: (value: { supported: boolean; started: boolean }) => void
    const startPromise = new Promise<{ supported: boolean; started: boolean }>(
      (res) => {
        resolveStart = res
      },
    )

    const startPracticeSpy = vi.fn().mockReturnValue(startPromise)
    const updatePracticeSpy = vi
      .fn()
      .mockResolvedValue({ supported: true, updated: true })
    const endPracticeSpy = vi
      .fn()
      .mockResolvedValue({ supported: true, ended: true })

    const mockPlugin: LiveActivityPlugin = {
      startPractice: startPracticeSpy,
      updatePractice: updatePracticeSpy,
      endPractice: endPracticeSpy,
    }
    const bridge = new PracticeActivityBridge(mockPlugin)

    // Trigger start (in flight)
    const startCall = bridge.start({ total: 5, prompt: 'Uno' })

    // Immediately trigger update while start is still resolving
    const updateCall = bridge.update({
      completed: 1,
      remaining: 4,
      prompt: 'Dos',
    })

    // Update should not have been called yet since start hasn't resolved
    expect(updatePracticeSpy).not.toHaveBeenCalled()

    // Resolve start
    resolveStart!({ supported: true, started: true })
    await startCall
    await updateCall

    // Now update should have been called
    expect(updatePracticeSpy).toHaveBeenCalledWith({
      completed: 1,
      remaining: 4,
      prompt: 'Dos',
    })
    expect(bridge.isActive()).toBe(true)

    // Clean teardown
    await bridge.end()
    expect(bridge.isActive()).toBe(false)
  })

  it('safely handles native plugin failures without throwing or destabilizing state', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('ios')

    const startPracticeSpy = vi
      .fn()
      .mockRejectedValue(new Error('Permission denied'))
    const updatePracticeSpy = vi
      .fn()
      .mockRejectedValue(new Error('Bridge error'))
    const endPracticeSpy = vi.fn().mockRejectedValue(new Error('Bridge error'))

    const mockPlugin: LiveActivityPlugin = {
      startPractice: startPracticeSpy,
      updatePractice: updatePracticeSpy,
      endPractice: endPracticeSpy,
    }
    const bridge = new PracticeActivityBridge(mockPlugin)

    await expect(bridge.start({ total: 5 })).resolves.toBeUndefined()
    expect(bridge.isActive()).toBe(false)

    // Update should be safely skipped since start failed
    await expect(
      bridge.update({ completed: 1, remaining: 4 }),
    ).resolves.toBeUndefined()
    expect(updatePracticeSpy).not.toHaveBeenCalled()

    // End should complete cleanly
    await expect(bridge.end()).resolves.toBeUndefined()
    expect(bridge.isActive()).toBe(false)
  })

  it('serializes rapid session interleaving so an in-flight end() does not drop an immediate subsequent start()', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('ios')

    let resolveEnd: (value: { supported: boolean; ended: boolean }) => void
    const endPromise = new Promise<{ supported: boolean; ended: boolean }>(
      (res) => {
        resolveEnd = res
      },
    )

    const startPracticeSpy = vi
      .fn()
      .mockResolvedValue({ supported: true, started: true, id: 'act-2' })
    const updatePracticeSpy = vi
      .fn()
      .mockResolvedValue({ supported: true, updated: true })
    const endPracticeSpy = vi.fn().mockReturnValue(endPromise)

    const mockPlugin: LiveActivityPlugin = {
      startPractice: startPracticeSpy,
      updatePractice: updatePracticeSpy,
      endPractice: endPracticeSpy,
    }
    const bridge = new PracticeActivityBridge(mockPlugin)

    // Initially active from a previous session
    await bridge.start({ total: 10, title: 'Session 1' })
    expect(bridge.isActive()).toBe(true)

    // Trigger end() which is in-flight (not resolved yet)
    const endCall = bridge.end()

    // Immediately trigger start() for Session 2 while end() is still resolving in native land
    const startCall = bridge.start({ total: 20, title: 'Session 2' })

    // startPractice should not have been called yet because end is still in-flight
    expect(startPracticeSpy).toHaveBeenCalledTimes(1)

    // Now resolve end()
    resolveEnd!({ supported: true, ended: true })
    await endCall
    await startCall

    // Now Session 2 startPractice must have been called cleanly and bridge is active
    expect(startPracticeSpy).toHaveBeenCalledTimes(2)
    expect(startPracticeSpy).toHaveBeenLastCalledWith({
      total: 20,
      title: 'Session 2',
    })
    expect(bridge.isActive()).toBe(true)
  })
})
