// 公开 API：前台读模板（只返回 enabled）
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { listTemplates } from '../server/templatesRepo.js'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const rows = await listTemplates({ onlyEnabled: true })
    // 简单短缓存：前台用户拉模板列表频繁，缓存 60s
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120')
    res.status(200).json({ templates: rows })
  } catch (e: any) {
    console.error('[/api/templates]', e)
    res.status(500).json({ error: String(e?.message ?? e) })
  }
}
