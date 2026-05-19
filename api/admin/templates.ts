// admin 列表 + 新建：GET /api/admin/templates, POST /api/admin/templates
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { listTemplates, createTemplate } from '../../server/templatesRepo.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'GET') {
      const rows = await listTemplates({ onlyEnabled: false })
      res.status(200).json({ templates: rows })
      return
    }
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
      if (!body?.slug || !body?.name) {
        res.status(400).json({ error: 'slug and name required' })
        return
      }
      const row = await createTemplate(body)
      res.status(200).json({ template: row })
      return
    }
    res.status(405).json({ error: 'Method Not Allowed' })
  } catch (e: any) {
    console.error('[/api/admin/templates]', e)
    res.status(500).json({ error: String(e?.message ?? e) })
  }
}
