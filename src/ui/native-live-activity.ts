import { Capacitor, registerPlugin } from '@capacitor/core'

export interface LiveActivityStartResult {
  supported: boolean
  enabled?: boolean
  started: boolean
  id?: string
  error?: string
}

export interface LiveActivityUpdateResult {
  supported: boolean
  updated: boolean
}

export interface LiveActivityEndResult {
  supported: boolean
  ended: boolean
}

export interface LiveActivityPlugin {
  startPractice(options: {
    total: number
    prompt?: string
    title?: string
  }): Promise<LiveActivityStartResult>
  updatePractice(options: {
    completed: number
    remaining: number
    total?: number
    percentage?: number
    prompt?: string
  }): Promise<LiveActivityUpdateResult>
  endPractice(): Promise<LiveActivityEndResult>
}

// Fallback no-op implementation for web / Android platforms
const noopPlugin: LiveActivityPlugin = {
  startPractice: () => Promise.resolve({ supported: false, started: false }),
  updatePractice: () => Promise.resolve({ supported: false, updated: false }),
  endPractice: () => Promise.resolve({ supported: false, ended: false }),
}

const LiveActivityNative = registerPlugin<LiveActivityPlugin>('LiveActivity', {
  web: () => noopPlugin,
})

export class PracticeActivityBridge {
  private active = false

  public isSupported(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'
  }

  public async start(options: {
    total: number
    prompt?: string
    title?: string
  }): Promise<void> {
    if (!this.isSupported()) return
    try {
      const res = await LiveActivityNative.startPractice(options)
      if (res.started) {
        this.active = true
      }
    } catch {
      // Safe boundary: native live activity errors never disrupt practice
      this.active = false
    }
  }

  public async update(options: {
    completed: number
    remaining: number
    total?: number
    percentage?: number
    prompt?: string
  }): Promise<void> {
    if (!this.isSupported() || !this.active) return
    try {
      await LiveActivityNative.updatePractice(options)
    } catch {
      // Safe boundary
    }
  }

  public async end(): Promise<void> {
    if (!this.isSupported() || !this.active) return
    try {
      await LiveActivityNative.endPractice()
    } catch {
      // Safe boundary
    } finally {
      this.active = false
    }
  }
}

export const practiceActivity = new PracticeActivityBridge()
