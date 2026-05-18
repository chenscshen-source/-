// EdgeOne Pages Function: POST /api/generate
// 文件级路由：functions/api/generate.ts -> /api/generate
import { generate, type GenerateEnv } from '../../server/jimeng'

export async function onRequestPost(context: { request: Request; env: GenerateEnv }) {
  try {
    const input = await context.request.json() as any
    const out = await generate(input, context.env)
    return new Response(JSON.stringify(out), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    console.error('[/api/generate]', e)
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

// 非 POST → 405
export async function onRequest(context: { request: Request }) {
  if (context.request.method === 'POST') return onRequestPost(context as any)
  return new Response('Method Not Allowed', { status: 405 })
}
