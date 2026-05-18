// Vercel Serverless Function: 代理即梦 TOS 图片
// 路径：GET /api/img?u=<encoded url>
// 作用：剥掉 Referer，规避 TOS 防盗链；同时绕开浏览器 CORS
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const target = typeof req.query.u === 'string' ? req.query.u : req.query.u?.[0]
    if (!target) {
      res.status(400).send('missing u')
      return
    }
    const upstream = await fetch(target, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    if (!upstream.ok) {
      res.status(upstream.status).send(`upstream ${upstream.status}`)
      return
    }
    const ct = upstream.headers.get('content-type') ?? 'image/jpeg'
    res.setHeader('Content-Type', ct)
    res.setHeader('Cache-Control', 'public, max-age=3600')
    const ab = await upstream.arrayBuffer()
    res.status(200).send(Buffer.from(ab))
  } catch (e: any) {
    console.error('[/api/img]', e)
    res.status(500).send(String(e?.message ?? e))
  }
}
