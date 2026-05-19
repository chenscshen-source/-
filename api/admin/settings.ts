// 管理 prefix 设置：GET / PATCH /api/admin/settings
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { ensureSchema } from '../../server/db.js'
import { getPrefixSettings, updatePrefixSettings } from '../../server/settingsRepo.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await ensureSchema() // 兼容老 DB：保证 settings 表存在 + 默认值已 seed
    if (req.method === 'GET') {
      const settings = await getPrefixSettings()
      res.status(200).json({ settings })
      return
    }
    if (req.method === 'PATCH' || req.method === 'PUT') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
      const settings = await updatePrefixSettings(body ?? {})
      res.status(200).json({ settings })
      return
    }
    res.status(405).json({ error: 'Method Not Allowed' })
  } catch (e: any) {
    console.error('[/api/admin/settings]', e)
    res.status(500).json({ error: String(e?.message ?? e) })
  }
}
