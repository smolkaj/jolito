import { isStandalone } from './environment'
import { isSafeToReload } from './reload-safety'

/** Throttling window for update checks to avoid battery and network churn. */
const UPDATE_CHECK_THROTTLE_MS = 15 * 60 * 1000

/**
 * Triggers a manual update check and activation.
 * Used as a fallback when backend reports client version incompatibility.
 */
export async function triggerManualUpdate(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    window.location.reload()
    return
  }
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    if (reg) {
      let waiting: ServiceWorker | null = reg.waiting
      if (!waiting) {
        waiting = await new Promise<ServiceWorker | null>((resolve) => {
          const timeout = setTimeout(() => resolve(null), 8000)
          const onStateChange = (worker: ServiceWorker) => {
            if (worker.state === 'installed') {
              clearTimeout(timeout)
              resolve(worker)
            }
          }
          const checkWorker = (worker: ServiceWorker | null) => {
            if (!worker) return
            if (worker.state === 'installed') {
              clearTimeout(timeout)
              resolve(worker)
            } else {
              worker.addEventListener?.('statechange', () =>
                onStateChange(worker),
              )
            }
          }

          if (reg.installing) {
            checkWorker(reg.installing)
          } else if (reg.addEventListener) {
            reg.addEventListener(
              'updatefound',
              () => {
                checkWorker(reg.installing)
              },
              { once: true },
            )
          }

          const onUpdateDone = () => {
            setTimeout(() => {
              if (!reg.installing && !reg.waiting) {
                clearTimeout(timeout)
                resolve(null)
              }
            }, 50)
          }

          if (reg.update) {
            reg.update().then(onUpdateDone, () => {
              clearTimeout(timeout)
              resolve(null)
            })
          } else {
            clearTimeout(timeout)
            resolve(null)
          }
        })
      }

      if (waiting) {
        const waitForController = new Promise<void>((resolve) => {
          const timeout = setTimeout(resolve, 4000)
          if (typeof navigator.serviceWorker?.addEventListener === 'function') {
            navigator.serviceWorker.addEventListener(
              'controllerchange',
              () => {
                clearTimeout(timeout)
                resolve()
              },
              { once: true },
            )
          } else {
            clearTimeout(timeout)
            resolve()
          }
        })

        waiting.postMessage({ type: 'SKIP_WAITING' })
        await waitForController
        window.location.reload()
        return
      }
    }
  } catch {
    // Network or service worker error; reload cleanly anyway
  }
  window.location.reload()
}

/** One bounded request verifies the same asset set that the installer committed. */
export function startOfflineShell(): () => void {
  let cancel: (() => void) | undefined
  let stopped = false
  let refreshing = false
  let hadController = Boolean(navigator.serviceWorker?.controller)
  let currentRegistration: ServiceWorkerRegistration | null = null
  let pendingWaitingWorker: ServiceWorker | null = null
  let pendingReload = false
  let lastUpdateCheckTime = 0

  const reloadIfSafe = () => {
    if (stopped || refreshing) return
    if (!pendingReload) return
    if (isSafeToReload()) {
      refreshing = true
      window.location.reload()
    }
  }

  const activateWaitingWorker = (waiting: ServiceWorker) => {
    if (stopped) return
    pendingWaitingWorker = waiting
    const isHidden =
      typeof document !== 'undefined' && document.visibilityState === 'hidden'
    if (isStandalone() && isHidden && isSafeToReload()) {
      waiting.postMessage({ type: 'SKIP_WAITING' })
      pendingWaitingWorker = null
    }
  }

  const onControllerChange = () => {
    if (stopped || refreshing) return
    if (!hadController) {
      hadController = true
      return
    }
    pendingReload = true
    if (isStandalone()) {
      const isHidden =
        typeof document !== 'undefined' && document.visibilityState === 'hidden'
      if (!isHidden) {
        reloadIfSafe()
      }
    }
  }

  const checkUpdate = (reg: ServiceWorkerRegistration) => {
    if (stopped) return
    const now = Date.now()
    if (now - lastUpdateCheckTime < UPDATE_CHECK_THROTTLE_MS) return
    lastUpdateCheckTime = now
    void reg.update?.().catch(() => {})
  }

  const handleVisibilityChange = () => {
    if (stopped) return
    if (document.visibilityState === 'hidden') {
      const waiting = pendingWaitingWorker ?? currentRegistration?.waiting
      if (isStandalone() && waiting && isSafeToReload()) {
        waiting.postMessage({ type: 'SKIP_WAITING' })
        pendingWaitingWorker = null
      }
    } else if (document.visibilityState === 'visible') {
      if (isStandalone()) {
        reloadIfSafe()
      }
      if (currentRegistration) {
        checkUpdate(currentRegistration)
      }
    }
  }

  const handleOnline = () => {
    if (stopped || !currentRegistration) return
    checkUpdate(currentRegistration)
  }

  const prepare = () => {
    cancel?.()
    document.documentElement.dataset.offlineReady = 'false'
    let stoppedPreparation = false
    let channel: MessageChannel | undefined
    const finish = (ready: boolean) => {
      if (stopped || stoppedPreparation) return
      document.documentElement.dataset.offlineReady = String(ready)
      cancel?.()
      if (!ready)
        console.warn(
          'Offline preparation failed. Reconnect and reload to retry.',
        )
    }
    const timeout = window.setTimeout(() => finish(false), 30_000)
    cancel = () => {
      stoppedPreparation = true
      window.clearTimeout(timeout)
      if (channel) {
        channel.port1.onmessage = null
        channel.port1.close()
        channel.port2.close()
      }
    }
    void (async () => {
      const registration = await navigator.serviceWorker.register('/sw.js')
      if (stopped || stoppedPreparation) return
      currentRegistration = registration

      // Monitor updates on registration
      if (registration.waiting) {
        activateWaitingWorker(registration.waiting)
      }
      registration.addEventListener?.('updatefound', () => {
        const installing = registration.installing
        if (!installing) return
        installing.addEventListener?.('statechange', () => {
          if (
            installing.state === 'installed' &&
            navigator.serviceWorker?.controller
          ) {
            activateWaitingWorker(installing)
          }
        })
      })

      const worker = (await navigator.serviceWorker.ready).active
      if (stopped || stoppedPreparation) return
      if (!worker) return finish(false)
      channel = new MessageChannel()
      channel.port1.onmessage = (event: MessageEvent<unknown>) =>
        finish(event.data === 'cached')
      const buildId = document.querySelector<HTMLMetaElement>(
        'meta[name="jolito-build"]',
      )?.content
      worker.postMessage({ type: 'CHECK_OFFLINE_READY', buildId }, [
        channel.port2,
      ])
    })().catch(() => finish(false))
  }

  const suspend = () => {
    window.removeEventListener('load', prepare)
    cancel?.()
  }

  const resume = (event: PageTransitionEvent) => {
    if (stopped) return
    if (event.persisted) prepare()
    if (isStandalone()) {
      reloadIfSafe()
    }
    if (currentRegistration) checkUpdate(currentRegistration)
  }

  if (document.readyState === 'complete') prepare()
  else window.addEventListener('load', prepare, { once: true })

  window.addEventListener('pagehide', suspend)
  window.addEventListener('pageshow', resume)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('online', handleOnline)
  navigator.serviceWorker?.addEventListener?.(
    'controllerchange',
    onControllerChange,
  )

  return () => {
    stopped = true
    cancel?.()
    window.removeEventListener('load', prepare)
    window.removeEventListener('pagehide', suspend)
    window.removeEventListener('pageshow', resume)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    window.removeEventListener('online', handleOnline)
    navigator.serviceWorker?.removeEventListener?.(
      'controllerchange',
      onControllerChange,
    )
  }
}
