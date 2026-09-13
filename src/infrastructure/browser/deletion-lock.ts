import type { DeletionLock } from '../../application/ports'

export class BrowserDeletionLock implements DeletionLock {
  constructor(
    private readonly locks: Pick<LockManager, 'request'> | undefined,
  ) {}

  async run<T>(operation: () => T | Promise<T>): Promise<T> {
    if (!this.locks)
      throw new Error(
        'Update your browser and open Jolito over HTTPS to delete your account safely.',
      )
    return this.locks.request(
      'jolito-account-deletion',
      { ifAvailable: true },
      async (lock) => {
        if (!lock)
          throw new Error(
            'Account deletion is still running in another tab. Wait for it to finish, then try again.',
          )
        return operation()
      },
    )
  }
}

// The native app has one WebView (Info.plist disables multiple scenes). Its
// iOS 15 / capacitor:// runtime cannot require browser Web Locks support.
export class NativeDeletionLock implements DeletionLock {
  private busy = false

  async run<T>(operation: () => T | Promise<T>): Promise<T> {
    if (this.busy)
      throw new Error(
        'Account deletion is still running. Wait for it to finish, then try again.',
      )
    this.busy = true
    try {
      return await operation()
    } finally {
      this.busy = false
    }
  }
}
