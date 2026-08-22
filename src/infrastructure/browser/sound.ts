import type { Earcon, SoundPlayer } from '../../application/ports'

export class WebAudioSoundPlayer implements SoundPlayer {
  private ctx: AudioContext | null = null

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      if (AudioCtx) {
        this.ctx = new AudioCtx()
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }
    return this.ctx
  }

  play(earcon: Earcon): void {
    try {
      const ctx = this.getContext()
      if (!ctx) return

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
    } catch {
      // Audio is non-critical sensory enhancement; never fail loudly or block review
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
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = type
    osc.frequency.setValueAtTime(freq, startTime)

    gain.gain.setValueAtTime(0.001, startTime)
    gain.gain.exponentialRampToValueAtTime(gainValue, startTime + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(startTime)
    osc.stop(startTime + duration)
  }
}
