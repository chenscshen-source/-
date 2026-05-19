// 上传图片到 Vercel Blob：POST /api/admin/upload
// 请求体：{ filename: "cover.jpg", dataUrl: "data:image/jpeg;base64,..." }
// 返回：  { url: "https://....blob.vercel-storage.com/..." }
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { put } from '@vercel/blob'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const { filename, dataUrl } = body ?? {}
    if (!filename || !dataUrl) {
      res.status(400).json({ error: 'filename and dataUrl required' })
      return
    }
    const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl)
    if (!m) {
      res.status(400).json({ error: 'invalid dataUrl' })
      return
    }
    const [, contentType, b64] = m
    const buf = Buffer.from(b64, 'base64')
    const { url } = await put(`uploads/${Date.now()}-${filename}`, buf, {
      access: 'public',
      contentType,
      addRandomSuffix: true,
    })
    res.status(200).json({ url })
  } catch (e: any) {
    console.error('[/api/admin/upload]', e)
    res.status(500).json({ error: String(e?.message ?? e) })
  }
}

export const config = { maxDuration: 30 }
