import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { App } from './jolito'
import { StorageRecovery } from './ui/StorageRecovery'
import { enforceCanonicalHost } from './infrastructure/browser/host'
import { initializeBrowserServices } from './infrastructure/browser/services'
import celebrateUrl from '../assets/jolito-celebrate.webp'
import logoUrl from '../assets/jolito-welcome.webp'

const isRedirecting = enforceCanonicalHost()

if (!isRedirecting) {
  const root = createRoot(document.getElementById('root')!)
  const start = () => {
    const initialized = initializeBrowserServices()
    if (initialized.status === 'recovery') {
      root.render(<StorageRecovery recovery={initialized} onRetry={start} />)
      return
    }
    const services = initialized.services
    root.render(
      <StrictMode>
        <App services={services} />
      </StrictMode>,
    )
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      if (document.readyState === 'complete') void prepareOfflineShell(services)
      else
        window.addEventListener(
          'load',
          () => {
            void prepareOfflineShell(services)
          },
          { once: true },
        )
    }
  }
  start()
}

async function prepareOfflineShell(
  services: import('./application/ports').AppServices,
) {
  if (typeof Image !== 'undefined') {
    const imgCelebrate = new Image()
    imgCelebrate.src = celebrateUrl
    const imgLogo = new Image()
    imgLogo.src = logoUrl
  }

  const prewarms: Array<Promise<unknown>> = []
  if (services.assistant.loadDictionary) {
    prewarms.push(Promise.resolve(services.assistant.loadDictionary()))
  }
  if (services.speaker.prewarm) {
    prewarms.push(Promise.resolve(services.speaker.prewarm()))
  }
  await Promise.allSettled(prewarms)

  await navigator.serviceWorker.register('/sw.js')
  const activeWorker = (await navigator.serviceWorker.ready).active
  if (!activeWorker) return

  const urls = Array.from(
    new Set([
      window.location.href,
      celebrateUrl,
      logoUrl,
      ...performance
        .getEntriesByType('resource')
        .map((resource) => resource.name),
    ]),
  )
  const channel = new MessageChannel()
  const cached = new Promise<void>((resolve) => {
    channel.port1.onmessage = () => resolve()
  })
  activeWorker.postMessage({ type: 'CACHE_URLS', urls }, [channel.port2])
  await cached
  document.documentElement.dataset.offlineReady = 'true'
}
