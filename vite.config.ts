import type { Connect, Plugin } from 'vite'
import { defineConfig, searchForWorkspaceRoot } from 'vite'
import react from '@vitejs/plugin-react'
import { offlineShellPlugin } from './scripts/offline-shell-plugin.ts'

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

function createFeedbackMiddleware(): Connect.NextHandleFunction {
  return (req, res, next) => {
    const reqUrl = req.url
    if (!reqUrl || !reqUrl.startsWith('/api/feedback')) {
      next()
      return
    }
    void (async () => {
      try {
        const { handleFeedbackRequest } =
          await import('./src/worker/feedback-route.ts')
        const hostHeader = req.headers.host
        const origin = `http://${typeof hostHeader === 'string' ? hostHeader : 'localhost'}`
        const fullUrl = new URL(reqUrl, origin)
        const chunks: Buffer[] = []
        for await (const chunk of req as AsyncIterable<Uint8Array | string>) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        }
        const bodyBuf = Buffer.concat(chunks)
        const reqInit: RequestInit = {
          method: req.method ?? 'GET',
          headers: req.headers as HeadersInit,
        }
        if (
          req.method !== 'GET' &&
          req.method !== 'HEAD' &&
          bodyBuf.length > 0
        ) {
          reqInit.body = bodyBuf
        }
        const webReq = new Request(fullUrl.toString(), reqInit)
        const webRes = await handleFeedbackRequest(webReq, {
          FEEDBACK_NOTIFICATION_EMAIL: process.env.FEEDBACK_NOTIFICATION_EMAIL,
          FEEDBACK_SENDER_EMAIL: process.env.FEEDBACK_SENDER_EMAIL,
          RESEND_API_KEY: process.env.RESEND_API_KEY,
        })
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

function apiDevPlugin(): Plugin {
  const ttsMiddleware = createTtsMiddleware()
  const feedbackMiddleware = createFeedbackMiddleware()
  return {
    name: 'jolito-api-dev',
    configureServer(server) {
      server.middlewares.use(ttsMiddleware)
      server.middlewares.use(feedbackMiddleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(ttsMiddleware)
      server.middlewares.use(feedbackMiddleware)
    },
  }
}

export default defineConfig({
  plugins: [react(), apiDevPlugin(), offlineShellPlugin()],
  server: {
    fs: {
      allow: [searchForWorkspaceRoot(process.cwd()), '..'],
    },
  },
})
