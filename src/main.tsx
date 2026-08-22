import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { App } from './ritmo'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

async function prepareOfflineShell() {
  await navigator.serviceWorker.register('/sw.js')
  const activeWorker = (await navigator.serviceWorker.ready).active
  if (!activeWorker) return

  const urls = [
    window.location.href,
    ...performance
      .getEntriesByType('resource')
      .map((resource) => resource.name),
  ]
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
