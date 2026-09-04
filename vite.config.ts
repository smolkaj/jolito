import type { Connect, Plugin } from 'vite'
import { defineConfig, searchForWorkspaceRoot } from 'vite'
import react from '@vitejs/plugin-react'

function createTtsMiddleware(): Connect.NextHandleFunction {
  return (req, res, next) => {
    const reqUrl = req.url
    if (!reqUrl || !reqUrl.startsWith('/api/tts')) {
      next()
      return
    }
    void (async () => {
      try {
        const { handleTtsRequest } = await import('./src/worker/tts-route.ts')
        const hostHeader = req.headers.host
        const origin = `http://${typeof hostHeader === 'string' ? hostHeader : 'localhost'}`
        const fullUrl = new URL(reqUrl, origin)
        const webReq = new Request(fullUrl.toString(), {
          method: req.method ?? 'GET',
          headers: req.headers as HeadersInit,
        })
        const webRes = await handleTtsRequest(webReq)
        res.statusCode = webRes.status
        webRes.headers.forEach((val, key) => {
          res.setHeader(key, val)
        })
        const buf = Buffer.from(await webRes.arrayBuffer())
        res.end(buf)
      } catch (err) {
        next(err)
      }
    })()
  }
}

function ttsDevPlugin(): Plugin {
  const middleware = createTtsMiddleware()
  return {
    name: 'jolito-tts-dev',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
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
