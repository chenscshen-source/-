import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isInviteRequired, isInviteSessionValid } from './inviteRepo.js'

function getCookie(req: VercelRequest, name: string): string | null {
  const raw = req.headers.cookie || ''
  if (!raw) return null
  const parts = raw.split(';').map(s => s.trim())
  for (const p of parts) {
    const idx = p.indexOf('=')
    if (idx <= 0) continue
    const k = p.slice(0, idx)
    if (k !== name) continue
    return decodeURIComponent(p.slice(idx + 1))
  }
  return null
}

export function getInviteSessionToken(req: VercelRequest): string | null {
  return getCookie(req, 'invite_session')
}

export async function requireInvite(req: VercelRequest, res: VercelResponse): Promise<boolean> {
  const required = await isInviteRequired()
  if (!required) return true
  const token = getInviteSessionToken(req)
  if (!token) {
    res.status(401).json({ error: 'INVITE_REQUIRED' })
    return false
  }
  const ok = await isInviteSessionValid(token)
  if (!ok) {
    res.status(401).json({ error: 'INVITE_REQUIRED' })
    return false
  }
  return true
}
