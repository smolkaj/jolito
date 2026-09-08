import type { Earcon, SoundPlayer } from '../../application/ports'

interface AudioSession {
  type?:
    | 'ambient'
    | 'playback'
    | 'transient'
    | 'transient-solo'
    | 'play-and-record'
    | 'auto'
}

export function configureAudioSessionCategory(
  category: 'ambient' | 'playback',
): void {
  if (typeof navigator === 'undefined') return
  const nav = navigator as unknown as { audioSession?: AudioSession }
  if (nav.audioSession && nav.audioSession.type !== category) {
    try {
      nav.audioSession.type = category
    } catch {
      // Ignore unsupported or restricted environments
    }
  }
}

export interface WebAudioSoundPlayerOptions {
  idleDelayMs?: number
}

export const DEFAULT_AUDIO_IDLE_DELAY_MS = 3000

export class WebAudioSoundPlayer implements SoundPlayer {
  private ctx: AudioContext | null = null
  private cleanupGestureListeners: (() => void) | null = null
  private cleanupLifecycleListeners: (() => void) | null = null
  private idleTimer: number | null = null
  private activeTones = 0
  private readonly idleDelayMs: number

  constructor(options?: WebAudioSoundPlayerOptions) {
    this.idleDelayMs = options?.idleDelayMs ?? DEFAULT_AUDIO_IDLE_DELAY_MS
    this.installUnlockListeners()
    this.installLifecycleListeners()
  }

  private installUnlockListeners(): void {
    if (typeof window === 'undefined') return
    if (this.cleanupGestureListeners) return
    const unlock = () => {
      configureAudioSessionCategory('ambient')
      const ctx = this.getContext()
      if (ctx && ctx.state !== 'running') {
        void ctx
          .resume()
          .then(() => {
            if (this.activeTones === 0) {
              this.scheduleIdleSuspend()
            }
          })
          .catch(() => {})
      } else if (this.activeTones === 0) {
        this.scheduleIdleSuspend()
      }
      this.removeUnlockListeners()
    }
    window.addEventListener('pointerdown', unlock, {
      passive: true,
      once: true,
    })
    window.addEventListener('touchstart', unlock, {
      passive: true,
      once: true,
    })
    window.addEventListener('keydown', unlock, { passive: true, once: true })
    this.cleanupGestureListeners = () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('touchstart', unlock)
      window.removeEventListener('keydown', unlock)
      this.cleanupGestureListeners = null
    }
  }

  private removeUnlockListeners(): void {
    this.cleanupGestureListeners?.()
  }

  private installLifecycleListeners(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        void this.suspend()
      } else if (document.visibilityState === 'visible') {
        this.cancelIdleSuspend()
        this.installUnlockListeners()
      }
    }
    const handlePageHide = () => {
      void this.suspend()
    }
    const handlePageShow = () => {
      this.cancelIdleSuspend()
      this.installUnlockListeners()
    }
    const handleOrientation = () => {
      this.cancelIdleSuspend()
      this.installUnlockListeners()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', handlePageHide)
    window.addEventListener('pageshow', handlePageShow)
    window.addEventListener('orientationchange', handleOrientation)
    this.cleanupLifecycleListeners = () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', handlePageHide)
      window.removeEventListener('pageshow', handlePageShow)
      window.removeEventListener('orientationchange', handleOrientation)
      this.cleanupLifecycleListeners = null
    }
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      if (AudioCtx) {
        try {
          this.ctx = new AudioCtx()
        } catch {
          this.ctx = null
        }
      }
    }
    return this.ctx
  }

  async suspend(): Promise<void> {
    this.cancelIdleSuspend()
    if (
      this.ctx &&
      this.ctx.state === 'running' &&
      typeof this.ctx.suspend === 'function'
    ) {
      try {
        await this.ctx.suspend()
      } catch {
        // Audio is non-critical; never fail loudly
      }
    }
    this.installUnlockListeners()
  }

  private scheduleIdleSuspend(): void {
    this.cancelIdleSuspend()
    if (this.activeTones > 0 || typeof window === 'undefined') return
    this.idleTimer = window.setTimeout(() => {
      void this.suspend()
    }, this.idleDelayMs)
  }

  private cancelIdleSuspend(): void {
    if (this.idleTimer !== null) {
      if (typeof window !== 'undefined') {
        window.clearTimeout(this.idleTimer)
      }
      this.idleTimer = null
    }
  }

  play(earcon: Earcon): void {
    try {
      configureAudioSessionCategory('ambient')
      const ctx = this.getContext()
      if (!ctx) return

      this.cancelIdleSuspend()

      if (ctx.state !== 'running') {
        this.installUnlockListeners()
        void ctx
          .resume()
          .then(() => {
            if (ctx.state === 'running') {
              this.dispatchEarcon(ctx, earcon)
            }
          })
          .catch(() => {})
        return
      }

      this.dispatchEarcon(ctx, earcon)
    } catch {
      // Audio is non-critical sensory enhancement; never fail loudly or block review
    }
  }

  private dispatchEarcon(ctx: AudioContext, earcon: Earcon): void {
    const now = ctx.currentTime

    switch (earcon) {
      case 'reveal': {
        // Soft, ascending two-note chime (C5 -> E5)
        this.playTone(ctx, 523.25, now, 0.12, 0.08)
        this.playTone(ctx, 659.25, now + 0.07, 0.18, 0.08)
        break
      }
      case 'again': {
        // Gentle grounding tone (E4)
        this.playTone(ctx, 329.63, now, 0.22, 0.07, 'triangle')
        break
      }
      case 'hard': {
        // Warm neutral tone (A4)
        this.playTone(ctx, 440.0, now, 0.2, 0.07, 'triangle')
        break
      }
      case 'good': {
        // Bright positive chime (D5 -> A5)
        this.playTone(ctx, 587.33, now, 0.18, 0.08, 'sine')
        this.playTone(ctx, 880.0, now + 0.06, 0.22, 0.06, 'sine')
        break
      }
      case 'easy': {
        // Flowing joyful arpeggio (C5 -> E5 -> G5 -> C6)
        this.playTone(ctx, 523.25, now, 0.1, 0.07, 'sine')
        this.playTone(ctx, 659.25, now + 0.05, 0.1, 0.07, 'sine')
        this.playTone(ctx, 783.99, now + 0.1, 0.12, 0.07, 'sine')
        this.playTone(ctx, 1046.5, now + 0.15, 0.25, 0.08, 'sine')
        break
      }
      case 'complete': {
        // Celebratory major triad (A4 -> C#5 -> E5)
        this.playTone(ctx, 440.0, now, 0.28, 0.07, 'sine')
        this.playTone(ctx, 554.37, now + 0.08, 0.28, 0.07, 'sine')
        this.playTone(ctx, 659.25, now + 0.16, 0.4, 0.08, 'sine')
        break
      }
    }
  }

  private playTone(
    ctx: AudioContext,
    freq: number,
    startTime: number,
    duration: number,
    gainValue: number,
    type: OscillatorType = 'sine',
  ) {
    this.cancelIdleSuspend()

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = type
    osc.frequency.setValueAtTime(freq, startTime)

    gain.gain.setValueAtTime(0.001, startTime)
    gain.gain.exponentialRampToValueAtTime(gainValue, startTime + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.onended = () => {
      try {
        osc.disconnect()
        gain.disconnect()
      } catch {
        // Ignore errors during node disconnection
      }
      this.activeTones = Math.max(0, this.activeTones - 1)
      if (this.activeTones === 0) {
        this.scheduleIdleSuspend()
      }
    }

    this.activeTones++
    osc.start(startTime)
    osc.stop(startTime + duration)
  }

  destroy(): void {
    this.cancelIdleSuspend()
    this.removeUnlockListeners()
    this.cleanupLifecycleListeners?.()
    void this.suspend()
  }
}
