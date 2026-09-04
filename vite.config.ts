import type { Plugin } from 'vite'
import { defineConfig, searchForWorkspaceRoot } from 'vite'
import react from '@vitejs/plugin-react'

process.env.VITE_CONFIG_NATIVE_IGNORE_WARNING = 'true'

function ttsDevPlugin(): Plugin {
  return {
    name: 'jolito-tts-dev',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const reqUrl = req.url
        if (!reqUrl || !reqUrl.startsWith('/api/tts')) {
          next()
          return
        }
        void (async () => {
          try {
            const { handleTtsRequest } = await import('./src/worker/tts-route')
            const origin = `http://${req.headers.host ?? 'localhost'}`
            const fullUrl = new URL(reqUrl, origin)
            const webReq = new Request(fullUrl.toString(), {
              method: req.method ?? 'GET',
              headers: req.headers as HeadersInit,
            })
            const webRes = await handleTtsRequest(webReq)
            res.statusCode = webRes.status
            webRes.headers.forEach((val, key) => res.setHeader(key, val))
            const buf = Buffer.from(await webRes.arrayBuffer())
            res.end(buf)
          } catch (err) {
            next(err)
          }
        })()
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        const reqUrl = req.url
        if (!reqUrl || !reqUrl.startsWith('/api/tts')) {
          next()
          return
        }
        void (async () => {
          try {
            const { handleTtsRequest } = await import('./src/worker/tts-route')
            const origin = `http://${req.headers.host ?? 'localhost'}`
            const fullUrl = new URL(reqUrl, origin)
            const webReq = new Request(fullUrl.toString(), {
              method: req.method ?? 'GET',
              headers: req.headers as HeadersInit,
            })
            const webRes = await handleTtsRequest(webReq)
            res.statusCode = webRes.status
            webRes.headers.forEach((val, key) => res.setHeader(key, val))
            const buf = Buffer.from(await webRes.arrayBuffer())
            res.end(buf)
          } catch (err) {
            next(err)
          }
        })()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), ttsDevPlugin()],
  server: {
    fs: {
      allow: [searchForWorkspaceRoot(process.cwd()), '..'],
    },
  },
})
