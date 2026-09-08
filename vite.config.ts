import type { Connect, Plugin } from 'vite'
import { defineConfig, searchForWorkspaceRoot } from 'vite'
import react from '@vitejs/plugin-react'
import { legalPageHtml, dictionarySourcesHtml } from './scripts/legal-page.tsx'

function legalPagePlugin(): Plugin {
  return {
    name: 'jolito-legal-page',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if ((req.url ?? '').split('?')[0] === '/dict/sources.html') {
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(dictionarySourcesHtml())
          return
        }
        if (
          ![
            '/privacy',
            '/privacy/',
            '/privacy.html',
            '/privacy/index.html',
          ].includes((req.url ?? '').split('?')[0]!)
        )
          return next()
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.end(legalPageHtml())
      })
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'dict/sources.html',
        source: dictionarySourcesHtml(),
      })
      for (const fileName of ['privacy.html', 'privacy/index.html']) {
        this.emitFile({ type: 'asset', fileName, source: legalPageHtml() })
      }
    },
  }
}

function apiDevPlugin(): Plugin {
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    const pathname = new URL(
      req.url ?? '/',
      'http://localhost',
    ).pathname.replace(/\/+$/, '')
    if (pathname !== '/api/tts' && pathname !== '/api/feedback') return next()
    void (async () => {
      const chunks: Buffer[] = []
      let size = 0
      for await (const chunk of req as AsyncIterable<Uint8Array | string>) {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        size += bytes.byteLength
        if (size > 32768) {
          res.statusCode = 413
          res.end('Request is too large.')
          return
        }
        chunks.push(bytes)
      }
      const origin = `http://${req.headers.host ?? 'localhost'}`
      const method = req.method ?? 'GET'
      const request = new Request(new URL(req.url ?? '/', origin), {
        method,
        headers: req.headers as HeadersInit,
        ...(method === 'GET' || method === 'HEAD'
          ? {}
          : { body: Buffer.concat(chunks) }),
      })
      const response =
        pathname === '/api/tts'
          ? await (
              await import('./src/worker/tts-route.ts')
            ).handleTtsRequest(request)
          : await (
              await import('./src/worker/feedback-route.ts')
            ).handleFeedbackRequest(request, {
              FEEDBACK_NOTIFICATION_EMAIL:
                process.env.FEEDBACK_NOTIFICATION_EMAIL,
              FEEDBACK_SENDER_EMAIL: process.env.FEEDBACK_SENDER_EMAIL,
              RESEND_API_KEY: process.env.RESEND_API_KEY,
            })
      res.statusCode = response.status
      response.headers.forEach((value, key) => res.setHeader(key, value))
      res.end(Buffer.from(await response.arrayBuffer()))
    })().catch(next)
  }
  return {
    name: 'jolito-api-dev',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}

export default defineConfig({
  plugins: [react(), apiDevPlugin(), legalPagePlugin()],
  server: {
    fs: {
      allow: [searchForWorkspaceRoot(process.cwd()), '..'],
    },
  },
})
