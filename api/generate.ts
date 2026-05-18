// Vercel Serverless Function: 调用即梦生成婚纱合成图
// 路径：POST /api/generate
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { generate } from '../server/jimeng.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }
  try {
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
