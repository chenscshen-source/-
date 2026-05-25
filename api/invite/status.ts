import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isInviteRequired, isInviteSessionValid } from '../../server/inviteRepo.js'

function readCookie(req: VercelRequest, name: string): string | null {
  const raw = req.headers.cookie || ''
  for (const part of raw.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (k === name) return decodeURIComponent(rest.join('='))
  }
  return null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const required = await isInviteRequired()
    if (!required) {
      res.status(200).json({ required: false, verified: true })
      return
    }
    const token = readCookie(req, 'invite_session')
    const verified = token ? await isInviteSessionValid(token) : false
    res.status(200).json({ required: true, verified })
  } catch (e: any) {
    res.status(500).json({ error: String(e?.message ?? e) })
  }
}
