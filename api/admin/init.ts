// 一次性建表（幂等）：POST /api/admin/init
// 部署后第一次访问触发；之后任何时候访问也无害
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { ensureSchema } from '../../server/db.js'
import { countTemplates } from '../../server/templatesRepo.js'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    await ensureSchema()
    const n = await countTemplates()
    res.status(200).json({ ok: true, count: n, message: `Schema ready. ${n} templates exist.` })
  } catch (e: any) {
    console.error('[/api/admin/init]', e)
    res.status(500).json({ error: String(e?.message ?? e) })
  }
}
