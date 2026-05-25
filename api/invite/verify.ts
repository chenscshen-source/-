import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyInviteCodeAndCreateSession } from '../../server/inviteRepo.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const code = String(body?.code ?? '').trim()
    if (!code) {
      res.status(400).json({ error: '邀请码不能为空' })
      return
    }
    const out = await verifyInviteCodeAndCreateSession(code)
    if (!out) {
      res.status(400).json({ error: '邀请码无效、已过期或次数已用完' })
      return
    }
    res.setHeader('Set-Cookie', `invite_session=${encodeURIComponent(out.token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 3600}`)
    res.status(200).json({ ok: true })
  } catch (e: any) {
    res.status(500).json({ error: String(e?.message ?? e) })
  }
}
