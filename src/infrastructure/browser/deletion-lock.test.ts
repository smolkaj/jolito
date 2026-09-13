import { expect, it, vi } from 'vitest'
import { BrowserDeletionLock, NativeDeletionLock } from './deletion-lock'

it('fails closed without browser coordination and never starts the operation', async () => {
  const operation = vi.fn()
  await expect(
    new BrowserDeletionLock(undefined).run(operation),
  ).rejects.toThrow('Update your browser')
  expect(operation).not.toHaveBeenCalled()
})

it('preserves an occupied browser lock and runs only after the current operation releases it', async () => {
  const operation = vi.fn(() => Promise.resolve('complete'))
  let available = false
  const request = vi.fn(
    <T>(
      name: string,
      options: LockOptions | LockGrantedCallback<T>,
      callback?: LockGrantedCallback<T>,
    ) => {
      const handler = typeof options === 'function' ? options : callback!
      return Promise.resolve(
        handler(available ? { name, mode: 'exclusive' } : null),
      )
    },
  )
  const lock = new BrowserDeletionLock({ request })
  await expect(lock.run(operation)).rejects.toThrow(
    'still running in another tab',
  )
  expect(operation).not.toHaveBeenCalled()
  available = true
  await expect(lock.run(operation)).resolves.toBe('complete')
  expect(request).toHaveBeenLastCalledWith(
    'jolito-account-deletion',
    { ifAvailable: true },
    expect.any(Function),
  )
})

it.each([false, true])(
  'serializes native operations and releases after settled rejection=%s',
  async (reject) => {
    const lock = new NativeDeletionLock()
    let release!: () => void
    const pending = lock.run(async () => {
      await new Promise<void>((resolve) => {
        release = resolve
      })
      if (reject) throw new Error('Interrupted')
      return 'complete'
    })
    const competing = vi.fn()
    await expect(lock.run(competing)).rejects.toThrow(
      'Account deletion is still running',
    )
    expect(competing).not.toHaveBeenCalled()
    release()
    if (reject) await expect(pending).rejects.toThrow('Interrupted')
    else await expect(pending).resolves.toBe('complete')
    await expect(lock.run(() => Promise.resolve('retry'))).resolves.toBe(
      'retry',
    )
  },
)
