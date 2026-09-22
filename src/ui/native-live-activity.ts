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

export const LiveActivityNative = registerPlugin<LiveActivityPlugin>(
  'LiveActivity',
  {
    web: () => noopPlugin,
  },
)

export class PracticeActivityBridge {
  private active = false
  private startPromise: Promise<boolean> | null = null
  private plugin: LiveActivityPlugin

  constructor(plugin: LiveActivityPlugin = LiveActivityNative) {
    this.plugin = plugin
  }

  public isSupported(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'
  }

  public isActive(): boolean {
    return this.active
  }

  public async start(options: {
    total: number
    prompt?: string
    title?: string
  }): Promise<void> {
    if (!this.isSupported()) return
    if (this.active || this.startPromise) return

    const promise = (async () => {
      try {
        const res = await this.plugin.startPractice(options)
        this.active = Boolean(res.started)
        return this.active
      } catch {
        this.active = false
        return false
      } finally {
        this.startPromise = null
      }
    })()

    this.startPromise = promise
    await promise
  }

  public async update(options: {
    completed: number
    remaining: number
    total?: number
    percentage?: number
    prompt?: string
  }): Promise<void> {
    if (!this.isSupported()) return
    if (this.startPromise) {
      await this.startPromise
    }
    if (!this.active) return
    try {
      await this.plugin.updatePractice(options)
    } catch {
      // Safe boundary: live activity updates never disrupt study flow
    }
  }

  public async end(): Promise<void> {
    if (!this.isSupported()) return
    if (this.startPromise) {
      await this.startPromise
    }
    if (!this.active) return
    try {
      await this.plugin.endPractice()
    } catch {
      // Safe boundary
    } finally {
      this.active = false
    }
  }
}

export const practiceActivity = new PracticeActivityBridge()
