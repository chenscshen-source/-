// Vercel Serverless Function: 调用即梦生成婚纱合成图
// 路径：POST /api/generate
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { generate } from '../server/jimeng.js'
import { getInviteSessionToken, requireInvite } from '../server/inviteAuth.js'
import { consumeInviteUsageBySession, isInviteRequired } from '../server/inviteRepo.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }
  try {
    const ok = await requireInvite(req, res)
    if (!ok) return
    const required = await isInviteRequired()
    if (required) {
      const token = getInviteSessionToken(req)
      if (!token) {
        res.status(401).json({ error: 'INVITE_REQUIRED' })
        return
      }
      const consumed = await consumeInviteUsageBySession(token)
      if (consumed === 'invalid') {
        res.status(401).json({ error: 'INVITE_REQUIRED' })
        return
      }
      if (consumed === 'exhausted') {
        res.status(403).json({ error: '邀请码次数已用完，请联系管理员获取新邀请码' })
        return
      }
    }
    // Vercel 已自动解析 JSON body
    const input = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const out = await generate(input)
    res.status(200).json(out)
  } catch (e: any) {
    console.error('[/api/generate]', e)
    res.status(500).json({ error: String(e?.message ?? e) })
  }
}

// Hobby 免费档单函数最长 60 秒；并发 n 张时即梦本身也大致在这个量级内
export const config = {
  maxDuration: 60,
}
