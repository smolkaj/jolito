import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/dm-mono/latin-400.css'
import '@fontsource/dm-mono/latin-500.css'
import '@fontsource/dm-sans/latin-400.css'
import '@fontsource/dm-sans/latin-500.css'
import '@fontsource/dm-sans/latin-600.css'
import '@fontsource/playfair-display/latin-500.css'
import '@fontsource/playfair-display/latin-500-italic.css'
import '@fontsource/playfair-display/latin-600.css'
import './styles.css'
import { createBrowserServices } from './infrastructure/browser/services'
import { App } from './ritmo'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App services={createBrowserServices()} />
  </StrictMode>,
)
