/** One bounded request verifies the same asset set that the installer committed. */
export function startOfflineShell(): () => void {
  let cancel: (() => void) | undefined

  const prepare = () => {
    cancel?.()
    document.documentElement.dataset.offlineReady = 'false'
    let stopped = false
    let channel: MessageChannel | undefined
    const finish = (ready: boolean) => {
      if (stopped) return
      document.documentElement.dataset.offlineReady = String(ready)
      cancel?.()
      if (!ready)
        console.warn(
          'Offline preparation failed. Reconnect and reload to retry.',
        )
    }
    const timeout = window.setTimeout(() => finish(false), 30_000)
    cancel = () => {
      stopped = true
      window.clearTimeout(timeout)
      if (channel) {
        channel.port1.onmessage = null
        channel.port1.close()
        channel.port2.close()
      }
    }
    void (async () => {
      await navigator.serviceWorker.register('/sw.js')
      if (stopped) return
      const worker = (await navigator.serviceWorker.ready).active
      if (stopped) return
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
    if (event.persisted) prepare()
  }
  if (document.readyState === 'complete') prepare()
  else window.addEventListener('load', prepare, { once: true })
  window.addEventListener('pagehide', suspend)
  window.addEventListener('pageshow', resume)
  return () => {
    cancel?.()
    window.removeEventListener('load', prepare)
    window.removeEventListener('pagehide', suspend)
    window.removeEventListener('pageshow', resume)
  }
}
