import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { App } from './jolito'
import { createBrowserServices } from './infrastructure/browser/services'
import celebrateUrl from '../assets/jolito-celebrate.png'

const services = createBrowserServices()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App services={services} />
  </StrictMode>,
)

async function prepareOfflineShell() {
  if (typeof Image !== 'undefined') {
    const img = new Image()
    img.src = celebrateUrl
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

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void prepareOfflineShell()
  })
}
