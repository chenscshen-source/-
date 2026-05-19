// admin 单条 CRUD：GET / PATCH / DELETE  /api/admin/templates/[id]
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getTemplate, updateTemplate, deleteTemplate } from '../../../server/templatesRepo.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const id = typeof req.query.id === 'string' ? req.query.id : req.query.id?.[0]
    if (!id) {
      res.status(400).json({ error: 'missing id' })
      return
    }
    if (req.method === 'GET') {
      const row = await getTemplate(id)
      if (!row) {
        res.status(404).json({ error: 'not found' })
        return
      }
      res.status(200).json({ template: row })
      return
    }
    if (req.method === 'PATCH' || req.method === 'PUT') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
      const row = await updateTemplate(id, body)
      if (!row) {
        res.status(404).json({ error: 'not found' })
        return
      }
      res.status(200).json({ template: row })
      return
    }
    if (req.method === 'DELETE') {
      const ok = await deleteTemplate(id)
      res.status(200).json({ ok })
      return
    }
    res.status(405).json({ error: 'Method Not Allowed' })
  } catch (e: any) {
    console.error('[/api/admin/templates/[id]]', e)
    res.status(500).json({ error: String(e?.message ?? e) })
  }
}
