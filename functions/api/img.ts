// EdgeOne Pages Function: GET /api/img?u=<encoded url>
// 代理即梦 TOS 图片，剥 Referer 规避防盗链 + 跨域
export async function onRequestGet(context: { request: Request }) {
  const url = new URL(context.request.url)
  const target = url.searchParams.get('u')
  if (!target) return new Response('missing u', { status: 400 })

  try {
    const upstream = await fetch(target, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    if (!upstream.ok) {
      return new Response(`upstream ${upstream.status}`, { status: upstream.status })
    }
    const ct = upstream.headers.get('content-type') ?? 'image/jpeg'
    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': ct,
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (e: any) {
    console.error('[/api/img]', e)
    return new Response(String(e?.message ?? e), { status: 500 })
  }
}
