import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  publicDir: 'assets',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Ritmo',
        short_name: 'Ritmo',
        description: 'Beautiful, spoken language cards that work offline.',
        display: 'standalone',
        background_color: '#fcf7f0',
        theme_color: '#29392e',
        start_url: '/',
        icons: [
          {
            src: '/ritmo-logo-concept.png',
            sizes: '1254x1254',
            type: 'image/png',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{css,html,js,png,svg,woff,woff2}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
})
