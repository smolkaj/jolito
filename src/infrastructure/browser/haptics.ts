import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import type { HapticEffect, HapticsPlayer } from '../../application/ports'

export interface Vibrator {
  vibrate(pattern: number | number[]): boolean
}

export interface NativeHapticsBridge {
  isNativePlatform(): boolean
  impact(options: { style: ImpactStyle }): Promise<void>
  notification(options: { type: NotificationType }): Promise<void>
  selectionChanged(): Promise<void>
}

export class BrowserHapticsPlayer implements HapticsPlayer {
  private vibrator: Vibrator | null
  private nativeBridge: NativeHapticsBridge | null

  constructor(
    vibrator?: Vibrator | null,
    nativeBridge?: NativeHapticsBridge | null,
  ) {
    if (vibrator !== undefined) {
      this.vibrator = vibrator
    } else {
      this.vibrator =
        typeof navigator !== 'undefined' &&
        typeof navigator.vibrate === 'function'
          ? navigator
          : null
    }

    if (nativeBridge !== undefined) {
      this.nativeBridge = nativeBridge
    } else {
      this.nativeBridge = {
        isNativePlatform: () => Capacitor.isNativePlatform(),
        impact: (opts) => Haptics.impact(opts),
        notification: (opts) => Haptics.notification(opts),
        selectionChanged: () => Haptics.selectionChanged(),
      }
    }
  }

  trigger(effect: HapticEffect): void {
    try {
      if (this.nativeBridge?.isNativePlatform()) {
        this.triggerNative(effect)
        return
      }

      this.triggerWebFallback(effect)
    } catch {
      // Haptics fail gracefully and silently if permission is denied or unsupported
    }
  }

  private triggerNative(effect: HapticEffect): void {
    if (!this.nativeBridge) return
    switch (effect) {
      case 'selection':
        void this.nativeBridge.selectionChanged().catch(() => {})
        break
      case 'again':
        void this.nativeBridge
          .notification({ type: NotificationType.Warning })
          .catch(() => {})
        break
      case 'hard':
        void this.nativeBridge
          .impact({ style: ImpactStyle.Medium })
          .catch(() => {})
        break
      case 'good':
        void this.nativeBridge
          .impact({ style: ImpactStyle.Light })
          .catch(() => {})
        break
      case 'easy':
      case 'complete':
        void this.nativeBridge
          .notification({ type: NotificationType.Success })
          .catch(() => {})
        break
    }
  }

  private triggerWebFallback(effect: HapticEffect): void {
    if (!this.vibrator) return
    switch (effect) {
      case 'selection':
        this.vibrator.vibrate(10)
        break
      case 'again':
        this.vibrator.vibrate([15, 30, 15])
        break
      case 'hard':
        this.vibrator.vibrate(20)
        break
      case 'good':
        this.vibrator.vibrate(15)
        break
      case 'easy':
        this.vibrator.vibrate(12)
        break
      case 'complete':
        this.vibrator.vibrate([15, 30, 15, 30, 20])
        break
    }
  }
}
