import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createInviteCode, isInviteRequired, listInviteCodes, setInviteRequired } from '../../server/inviteRepo.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'GET') {
      const [required, invites] = await Promise.all([isInviteRequired(), listInviteCodes()])
      res.status(200).json({ required, invites })
      return
    }
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
      const code = String(body?.code ?? '').trim()
      if (!code) {
        res.status(400).json({ error: 'code required' })
        return
      }
      const row = await createInviteCode({
        code,
        note: body?.note,
        max_uses: Number(body?.max_uses ?? 1),
        expires_at: body?.expires_at || null,
      })
      res.status(200).json({ invite: row })
      return
    }
    if (req.method === 'PATCH') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
      await setInviteRequired(!!body?.required)
      res.status(200).json({ ok: true, required: !!body?.required })
      return
    }
    res.status(405).json({ error: 'Method Not Allowed' })
  } catch (e: any) {
    res.status(500).json({ error: String(e?.message ?? e) })
  }
}
