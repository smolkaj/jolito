import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { App } from './jolito'
import { StorageRecovery } from './ui/StorageRecovery'
import { enforceCanonicalHost } from './infrastructure/browser/host'
import { initializeBrowserServices } from './infrastructure/browser/services'
import { startOfflineShell } from './infrastructure/browser/offline-shell'

const isRedirecting = enforceCanonicalHost()

if (!isRedirecting) {
  const root = createRoot(document.getElementById('root')!)
  const start = () => {
    const initialized = initializeBrowserServices()
    if (initialized.status === 'recovery') {
      root.render(<StorageRecovery recovery={initialized} onRetry={start} />)
      return
    }
    root.render(
      <StrictMode>
        <App services={initialized.services} />
      </StrictMode>,
    )
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      startOfflineShell()
    }
  }
  start()
}
