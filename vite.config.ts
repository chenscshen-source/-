import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { Agent, fetch as undiciFetch } from 'undici'
import { readFileSync, existsSync } from 'node:fs'

// 把 .env 注入 process.env（Vite 默认只会把 VITE_* 暴露给前端，不会注入到 node 进程）
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
}

import { generate } from './server/jimeng'

// 开发环境很多人挂代理/MITM 抓包，绕开证书校验
const insecureAgent = new Agent({ connect: { rejectUnauthorized: false } })

function apiPlugin(): Plugin {
  return {
    name: 'jimeng-api',
    configureServer(server) {
      // /api/generate ：调即梦
      server.middlewares.use('/api/generate', async (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end('Method Not Allowed'); return }
        try {
          const chunks: Buffer[] = []
          for await (const c of req) chunks.push(c as Buffer)
          const input = JSON.parse(Buffer.concat(chunks).toString('utf8'))
          const out = await generate(input)
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(out))
        } catch (e: any) {
          console.error('[/api/generate]', e)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: String(e?.message ?? e) }))
        }
      })

      // /api/img?u=<encoded url> ：把即梦的 TOS 图片代理回本机，规避 Referer 防盗链与 CORS
      server.middlewares.use('/api/img', async (req, res) => {
        try {
          const url = new URL(req.url!, 'http://x')
          const target = url.searchParams.get('u')
          if (!target) { res.statusCode = 400; res.end('missing u'); return }
          const upstream = await undiciFetch(target, {
            // 故意不带 Referer / Origin，让 TOS 的防盗链通过
            headers: { 'User-Agent': 'Mozilla/5.0' },
            dispatcher: insecureAgent,
          })
          if (!upstream.ok) {
            res.statusCode = upstream.status
            res.end(`upstream ${upstream.status}`)
            return
          }
          const ct = upstream.headers.get('content-type') ?? 'image/jpeg'
          res.setHeader('Content-Type', ct)
          res.setHeader('Cache-Control', 'public, max-age=3600')
          const ab = await upstream.arrayBuffer()
          res.end(Buffer.from(ab))
        } catch (e: any) {
          console.error('[/api/img]', e)
          res.statusCode = 500
          res.end(String(e?.message ?? e))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), apiPlugin()],
  server: {
    port: 5173,
    // 项目路径含中文（婚纱Demo），Vite 在 macOS 上算 allow list 时会产生编码乱码导致 403
    fs: { strict: false },
  },
})
