// =======================================================================
// 即梦 doubao-seedream-5-0-260128 — 火山方舟 (Ark v3) 直连
//
//   endpoint:  POST  https://ark.cn-beijing.volces.com/api/v3/images/generations
//   auth:      Bearer ark-...
//   console:   https://console.volcengine.com/ark
//
// 规则：
//   - size 用 preset：'1K' / '2K' / '4K'，这里默认 2K
//   - 单次 n:1（额度按张预扣），并发 n 次拿 n 张
//   - 参考图通过 `image` 字段（数组）传入；localhost 资源先下采样为 base64
//   - 返回的 TOS URL 透出前会包一层 /api/img 代理，规避防盗链 / CORS
// =======================================================================
import { readFile } from 'node:fs/promises'
import path from 'node:path'

// 本地代理软件（Clash/Surge/Charles）会做 TLS 拦截，dev 环境绕过证书校验；
// Vercel 生产无 MITM，不需要也不要 require undici（避免模块加载风险）。
// 这里通过 dynamic import 只在 dev 加载 undici。
let _agent: any = undefined
let _undiciFetch: any = undefined
async function getDevAgent() {
  if (_agent !== undefined) return _agent
  if (process.env.NODE_ENV === 'production') {
    _agent = null
    return null
  }
  try {
    const u = await import('undici')
    _undiciFetch = u.fetch
    _agent = new u.Agent({ connect: { rejectUnauthorized: false } })
  } catch {
    _agent = null
  }
  return _agent
}

export interface GenerateInput {
  prompt: string
  assists?: string[]
  groomFace: string
  brideFace: string
  n?: number
}

export interface GenerateOutput {
  images: string[]
}

function getApiKey(): string {
  const k = process.env.JIMENG_API_KEY
  if (!k) throw new Error('Missing JIMENG_API_KEY')
  return k
}
const API_BASE = process.env.JIMENG_BASE_URL ?? 'https://ark.cn-beijing.volces.com'
const MODEL = process.env.JIMENG_MODEL ?? 'doubao-seedream-4-5-251128'
// 2K = 1760x2368（竖版）。4K 在 Vercel Hobby 60s 函数上限下并发 3 张容易超时。
const SIZE = process.env.JIMENG_SIZE ?? '2K'
const WATERMARK = (process.env.JIMENG_WATERMARK ?? 'false') === 'true'
// Seedream 默认会"智能改写" prompt（mode=standard）。设为 'off' 时按用户原文严格执行，
// 适合"参考图+精确指令"场景，避免模型为了画面好看而忽略身份特征。
const OPTIMIZE_MODE = process.env.JIMENG_OPTIMIZE_MODE ?? 'standard'
// 输出图编码格式：png 无损（脸部细节更清晰），jpeg 有损但更小。控制台默认 png。
const OUTPUT_FORMAT = process.env.JIMENG_OUTPUT_FORMAT ?? 'png'
const ENDPOINT = `${API_BASE}/api/v3/images/generations`

/**
 * 把入参规整成 Ark 可消费的形式：
 *  - data:URL 透传（前端已经在浏览器 canvas 里压到 1024/q85，~200-400KB）
 *  - http(s) URL 透传（Ark 自己去拉）
 *  - localhost / 文件协议 URL → 读本地文件 → 转 base64（仅 dev 环境）
 *  生产环境不再做任何 sharp 压缩，避免 native binary 在 Vercel 上加载问题。
 */
async function toRef(u: string): Promise<string> {
  if (!u) return u
  if (u.startsWith('data:')) return u
  try {
    const url = new URL(u)
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.protocol === 'file:') {
      const filePath = path.join(process.cwd(), 'public', decodeURIComponent(url.pathname))
      const buf = await readFile(filePath)
      // 用扩展名推断 MIME；不行就 image/jpeg 兜底
      const ext = path.extname(filePath).toLowerCase().slice(1)
      const mime = ext === 'png' ? 'image/png' :
                   ext === 'webp' ? 'image/webp' :
                   ext === 'gif' ? 'image/gif' :
                   'image/jpeg'
      return `data:${mime};base64,${buf.toString('base64')}`
    }
  } catch {/* fall through */}
  return u
}

async function callOnce(refs: string[], prompt: string): Promise<string> {
  const body: Record<string, unknown> = {
    model: MODEL,
    prompt,
    size: SIZE,
    sequential_image_generation: 'disabled',
    response_format: 'url',
    stream: false,
    watermark: WATERMARK,
  }
  // 这些字段只有 5.0 及以上模型支持；4.5 / 4.0 发了会 400
  if (/seedream-5/.test(MODEL)) {
    body.output_format = OUTPUT_FORMAT
    body.optimize_prompt_options = { mode: OPTIMIZE_MODE }
  }
  if (refs.length) body.image = refs

  const bodyStr = JSON.stringify(body)
  console.log('[jimeng] refs:', refs.length, 'body:', (bodyStr.length / 1024 / 1024).toFixed(2), 'MB',
    'prompt head:', prompt.slice(0, 120).replace(/\s+/g, ' '))

  // 本地代理软件偶发地在 TLS 握手 / 上传阶段切连接（ECONNRESET / ETIMEDOUT / socket hang up）。
  // 这类是瞬时错误，重试一两次基本能过。
  const isTransient = (e: any) => {
    const code = e?.cause?.code || e?.code
    const msg = String(e?.cause?.message || e?.message || '')
    return (
      code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'UND_ERR_SOCKET' ||
      /socket disconnected|socket hang up|terminated|other side closed/i.test(msg)
    )
  }
  // dev：用 undici + 自定义 agent 绕过本地代理 MITM；prod：用 Node 内置 fetch
  const devAgent = await getDevAgent()
  const doFetch = (devAgent && _undiciFetch) ? _undiciFetch : globalThis.fetch
  const extraOpts: any = devAgent ? { dispatcher: devAgent } : {}

  let res: Response | undefined
  let lastErr: any
  const MAX_TRIES = 3
  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    try {
      res = await doFetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getApiKey()}`,
          'Content-Type': 'application/json',
        },
        body: bodyStr,
        ...extraOpts,
      })
      break
    } catch (e: any) {
      lastErr = e
      if (attempt < MAX_TRIES && isTransient(e)) {
        const backoff = 400 * attempt
        console.warn('[jimeng] transient fetch err (attempt %d/%d), retry in %dms:',
          attempt, MAX_TRIES, backoff, e?.cause?.code || e?.message)
        await new Promise(r => setTimeout(r, backoff))
        continue
      }
      break
    }
  }
  if (!res) {
    const cause = lastErr?.cause ? ` (cause: ${lastErr.cause?.code || ''} ${lastErr.cause?.message || lastErr.cause})` : ''
    throw new Error(`fetch to ark failed after ${MAX_TRIES} attempts: ${lastErr?.message || lastErr}${cause}`)
  }
  const text = await res.text()
  if (!res.ok) throw new Error(`seedream ${res.status}: ${text.slice(0, 400)}`)

  let json: any
  try { json = JSON.parse(text) } catch { throw new Error(`bad JSON: ${text.slice(0, 200)}`) }
  const url = json?.data?.[0]?.url
  if (!url) throw new Error(`no image in response: ${text.slice(0, 200)}`)
  return url
}

// 身份锁定前缀：告诉模型参考图里哪张是新郎、哪张是新娘，强制五官一致
function buildIdentityPrefix(groomIdx: number, brideIdx: number): string {
  const parts: string[] = []
  if (groomIdx >= 0) parts.push(`第${groomIdx + 1}张参考图为新郎本人`)
  if (brideIdx >= 0) parts.push(`第${brideIdx + 1}张参考图为新娘本人`)
  if (!parts.length) return ''
  return (
    `【身份锁定 - 最高优先级】${parts.join('，')}。` +
    `最终成图中新郎与新娘的五官、脸型、眉眼、鼻型、嘴型、肤色必须与参考图中的本人严格一致，` +
    `禁止改变身份特征；其余参考图仅作为场景与风格参考。\n\n`
  )
}

export async function generate(input: GenerateInput): Promise<GenerateOutput> {
  // 不再参考模板图，只用提示词 + 用户脸图（新郎、新娘）+ 可选辅助图
  const assists = (input.assists ?? []).filter(Boolean) as string[]
  const groom = input.groomFace || ''
  const bride = input.brideFace || ''

  // 脸图走高分辨率 (2048/q92)，辅助图走标准 (1280/q82)
  const assistRefs = await Promise.all(assists.map(u => toRef(u)))
  const groomRef = groom ? await toRef(groom) : ''
  const brideRef = bride ? await toRef(bride) : ''
  const faces = [groomRef, brideRef].filter(Boolean) as string[]

  // 顺序：assists → 新郎 → 新娘
  const refs = [...assistRefs, ...faces]
  const groomIdx = groomRef ? assists.length : -1
  const brideIdx = brideRef ? assists.length + (groomRef ? 1 : 0) : -1
  const prompt = buildIdentityPrefix(groomIdx, brideIdx) + input.prompt

  const n = input.n ?? 3

  // 并发跑 n 次，每次单图
  const settled = await Promise.allSettled(
    Array.from({ length: n }, () => callOnce(refs, prompt)),
  )
  const images: string[] = []
  const errors: string[] = []
  for (const r of settled) {
    if (r.status === 'fulfilled') images.push(r.value)
    else errors.push(String(r.reason?.message ?? r.reason))
  }
  if (images.length === 0) {
    throw new Error(errors.join(' | ') || 'all attempts failed')
  }
  while (images.length < n) images.push(images[images.length - 1])
  // 透出前包一层 /api/img 代理，浏览器侧无防盗链 / CORS 问题
  return { images: images.map(u => `/api/img?u=${encodeURIComponent(u)}`) }
}
