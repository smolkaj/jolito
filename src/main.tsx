import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { App } from './jolito'
import { enforceCanonicalHost } from './infrastructure/browser/host'
import { createBrowserServices } from './infrastructure/browser/services'
import celebrateUrl from '../assets/jolito-celebrate.png'
import logoUrl from '../assets/jolito-welcome.png'

const isRedirecting = enforceCanonicalHost()

if (!isRedirecting) {
  const services = createBrowserServices()

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App services={services} />
    </StrictMode>,
  )

  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      void prepareOfflineShell(services)
    })
  }
}

async function prepareOfflineShell(
  services: ReturnType<typeof createBrowserServices>,
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
