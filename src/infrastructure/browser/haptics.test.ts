import { ImpactStyle, NotificationType } from '@capacitor/haptics'
import { describe, expect, it, vi } from 'vitest'
import {
  BrowserHapticsPlayer,
  type NativeHapticsBridge,
  type Vibrator,
} from './haptics'

describe('BrowserHapticsPlayer', () => {
  it('delegates to native Capacitor bridge when on native platform', () => {
    const impact = vi.fn().mockResolvedValue(undefined)
    const notification = vi.fn().mockResolvedValue(undefined)
    const selectionChanged = vi.fn().mockResolvedValue(undefined)
    const vibrate = vi.fn().mockReturnValue(true)

    const mockBridge: NativeHapticsBridge = {
      isNativePlatform: () => true,
      impact,
      notification,
      selectionChanged,
    }
    const mockVibrator: Vibrator = {
      vibrate,
    }

    const player = new BrowserHapticsPlayer(mockVibrator, mockBridge)

    player.trigger('selection')
    expect(selectionChanged).toHaveBeenCalledTimes(1)
    expect(vibrate).not.toHaveBeenCalled()

    player.trigger('again')
    expect(notification).toHaveBeenCalledWith({
      type: NotificationType.Warning,
    })

    player.trigger('hard')
    expect(impact).toHaveBeenCalledWith({
      style: ImpactStyle.Medium,
    })

    player.trigger('good')
    expect(impact).toHaveBeenCalledWith({
      style: ImpactStyle.Light,
    })

    player.trigger('easy')
    expect(notification).toHaveBeenCalledWith({
      type: NotificationType.Success,
    })

    player.trigger('complete')
    expect(notification).toHaveBeenCalledWith({
      type: NotificationType.Success,
    })
  })

  it('delegates to web vibration API when on web platform', () => {
    const impact = vi.fn().mockResolvedValue(undefined)
    const notification = vi.fn().mockResolvedValue(undefined)
    const selectionChanged = vi.fn().mockResolvedValue(undefined)
    const vibrate = vi.fn().mockReturnValue(true)

    const mockBridge: NativeHapticsBridge = {
      isNativePlatform: () => false,
      impact,
      notification,
      selectionChanged,
    }
    const mockVibrator: Vibrator = {
      vibrate,
    }

    const player = new BrowserHapticsPlayer(mockVibrator, mockBridge)

    player.trigger('selection')
    expect(vibrate).toHaveBeenCalledWith(10)

    player.trigger('again')
    expect(vibrate).toHaveBeenCalledWith([15, 30, 15])

    player.trigger('hard')
    expect(vibrate).toHaveBeenCalledWith(20)

    player.trigger('good')
    expect(vibrate).toHaveBeenCalledWith(15)

    player.trigger('easy')
    expect(vibrate).toHaveBeenCalledWith(12)

    player.trigger('complete')
    expect(vibrate).toHaveBeenCalledWith([15, 30, 15, 30, 20])

    expect(selectionChanged).not.toHaveBeenCalled()
    expect(impact).not.toHaveBeenCalled()
    expect(notification).not.toHaveBeenCalled()
  })

  it('gracefully no-ops when no vibrator or native bridge is available', () => {
    const player = new BrowserHapticsPlayer(null, null)
    expect(() => {
      player.trigger('good')
      player.trigger('complete')
    }).not.toThrow()
  })

  it('catches and suppresses any unexpected vibration errors', () => {
    const vibrate = vi.fn().mockImplementation(() => {
      throw new Error('Vibration permission denied')
    })
    const mockVibrator: Vibrator = {
      vibrate,
    }
    const mockBridge: NativeHapticsBridge = {
      isNativePlatform: () => false,
      impact: vi.fn(),
      notification: vi.fn(),
      selectionChanged: vi.fn(),
    }

    const player = new BrowserHapticsPlayer(mockVibrator, mockBridge)
    expect(() => player.trigger('good')).not.toThrow()
  })

  it('instantiates with default constructor without throwing', () => {
    const player = new BrowserHapticsPlayer()
    expect(player).toBeInstanceOf(BrowserHapticsPlayer)
    expect(() => player.trigger('selection')).not.toThrow()
  })
})
