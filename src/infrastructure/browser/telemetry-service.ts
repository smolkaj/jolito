import { Capacitor } from '@capacitor/core'
import type { TelemetryService } from '../../application/ports.ts'
import type { EngagementTier } from '../../domain/telemetry.ts'
import {
  detectBrowser,
  detectDeviceType,
  detectOperatingSystem,
  detectPlatform,
} from './client-detection.ts'
import { getOrCreateDeviceId } from './device-id.ts'

export interface TelemetryServiceConfig {
  endpoint?: string
  storage?: Storage | null
  isNative?: boolean
  fetchFn?: typeof fetch
  nowFn?: () => Date
  doNotTrack?: boolean
  visibilityFn?: () => DocumentVisibilityState
  windowObj?: Window | null
}

interface StoredTelemetryState {
  date: string
  tier: EngagementTier
  reviews: number
}

const STORAGE_KEY = 'jolito:telemetry:v1'

export class ClientTelemetryService implements TelemetryService {
  private endpoint: string
  private storage: Storage | null
  private isNative: boolean
  private fetchFn: typeof fetch
  private nowFn: () => Date
  private doNotTrack: boolean
  private visibilityFn: () => DocumentVisibilityState
  private windowObj: Window | null
  private deviceId: string
  private cleanupListeners?: (() => void) | undefined
  private cachedState: StoredTelemetryState | null | undefined = undefined

  constructor(config: TelemetryServiceConfig = {}) {
    this.isNative = config.isNative ?? Capacitor.isNativePlatform()
    this.endpoint =
      config.endpoint ??
      (this.isNative
        ? 'https://joli.to/api/telemetry/heartbeat'
        : '/api/telemetry/heartbeat')
    this.storage =
      config.storage !== undefined
        ? config.storage
        : typeof window !== 'undefined'
          ? window.localStorage
          : null
    this.fetchFn =
      config.fetchFn ?? ((input, init) => globalThis.fetch(input, init))
    this.nowFn = config.nowFn ?? (() => new Date())
    this.doNotTrack =
      config.doNotTrack ??
      (typeof navigator !== 'undefined'
        ? navigator.doNotTrack === '1' ||
          (navigator as unknown as { globalPrivacyControl?: boolean })
            .globalPrivacyControl === true
        : false)
    this.visibilityFn =
      config.visibilityFn ??
      (() =>
        typeof document !== 'undefined' ? document.visibilityState : 'visible')
    this.windowObj =
      config.windowObj !== undefined
        ? config.windowObj
        : typeof window !== 'undefined'
          ? window
          : null
    this.deviceId = getOrCreateDeviceId(this.storage ?? undefined)
  }

  init(): void {
    if (this.doNotTrack || !this.windowObj) return

    const today = this.getTodayDateString()
    const state = this.loadState()
    if (state && state.date === today) {
      // Already recorded for today; zero listeners needed
      return
    }

    const handleInteraction = () => {
      if (this.visibilityFn() === 'visible') {
        this.recordUserInteraction()
      }
    }

    const win = this.windowObj
    win.addEventListener('pointerdown', handleInteraction, { passive: true })
    win.addEventListener('keydown', handleInteraction, { passive: true })

    this.cleanupListeners = () => {
      win.removeEventListener('pointerdown', handleInteraction)
      win.removeEventListener('keydown', handleInteraction)
    }
  }

  recordUserInteraction(): void {
    if (this.doNotTrack) return
    if (this.visibilityFn() !== 'visible') return

    const today = this.getTodayDateString()
    const state = this.loadState()

    if (state && state.date === today) {
      // Already recorded for today; detach listeners immediately
      this.teardown()
      return
    }

    const newState: StoredTelemetryState = {
      date: today,
      tier: 'casual',
      reviews: 0,
    }
    this.saveState(newState)
    this.teardown()
    this.sendPing('casual')
  }

  recordReview(): void {
    if (this.doNotTrack) return

    const today = this.getTodayDateString()
    const loaded = this.loadState()
    const isNewDay = !loaded || loaded.date !== today

    const state: StoredTelemetryState = isNewDay
      ? {
          date: today,
          tier: 'casual',
          reviews: 0,
        }
      : loaded

    if (isNewDay) {
      this.teardown()
    }

    state.reviews += 1

    let shouldUpgradeTo: EngagementTier | null = null
    if (state.reviews >= 20 && state.tier !== 'deep') {
      shouldUpgradeTo = 'deep'
    } else if (state.reviews >= 5 && state.tier === 'casual') {
      shouldUpgradeTo = 'active'
    } else if (isNewDay) {
      // First activity of today was a review; ensure user is recorded
      shouldUpgradeTo = 'casual'
    }

    if (shouldUpgradeTo) {
      state.tier = shouldUpgradeTo
      this.saveState(state)
      this.sendPing(shouldUpgradeTo)
    } else {
      this.saveState(state)
    }
  }

  teardown(): void {
    if (this.cleanupListeners) {
      this.cleanupListeners()
      this.cleanupListeners = undefined
    }
  }

  private sendPing(tier: EngagementTier): void {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return
    }

    const platform = detectPlatform(this.isNative)
    const os = detectOperatingSystem()
    const browser = detectBrowser(undefined, this.isNative)
    const deviceType = detectDeviceType()

    const payload = {
      deviceId: this.deviceId,
      platform,
      os,
      browser,
      deviceType,
      engagementTier: tier,
    }

    const body = JSON.stringify(payload)

    // Non-blocking fire-and-forget
    try {
      this.fetchFn(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body,
        keepalive: true,
      }).catch(() => {
        // Silently ignore network failures to adhere to zero-impact philosophy
      })
    } catch {
      // Silently ignore synchronous dispatch errors
    }
  }

  private getTodayDateString(): string {
    return this.nowFn().toISOString().slice(0, 10)
  }

  private loadState(): StoredTelemetryState | null {
    if (this.cachedState !== undefined) {
      return this.cachedState
    }
    if (!this.storage) {
      this.cachedState = null
      return null
    }
    try {
      const raw = this.storage.getItem(STORAGE_KEY)
      if (!raw) {
        this.cachedState = null
        return null
      }
      const parsed = JSON.parse(raw) as StoredTelemetryState
      if (
        typeof parsed?.date === 'string' &&
        typeof parsed?.tier === 'string' &&
        typeof parsed?.reviews === 'number'
      ) {
        this.cachedState = parsed
        return parsed
      }
      this.cachedState = null
      return null
    } catch {
      this.cachedState = null
      return null
    }
  }

  private saveState(state: StoredTelemetryState): void {
    this.cachedState = state
    if (!this.storage) return
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Storage unavailable / quota exceeded: ignore safely
    }
  }
}
