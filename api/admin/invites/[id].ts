import type { VercelRequest, VercelResponse } from '@vercel/node'
import { deleteInviteCode, updateInviteCode } from '../../../server/inviteRepo.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const id = String(req.query.id || '')
    if (!id) {
      res.status(400).json({ error: 'id required' })
      return
    }
    if (req.method === 'PATCH') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
      const row = await updateInviteCode(id, body)
      if (!row) {
        res.status(404).json({ error: 'not found' })
        return
      }
      res.status(200).json({ invite: row })
      return
    }
    if (req.method === 'DELETE') {
      const ok = await deleteInviteCode(id)
      res.status(200).json({ ok })
      return
    }
    res.status(405).json({ error: 'Method Not Allowed' })
  } catch (e: any) {
    res.status(500).json({ error: String(e?.message ?? e) })
  }
}
