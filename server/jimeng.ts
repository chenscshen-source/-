// =======================================================================
// 即梦 doubao-seedream — 火山方舟 (Ark v3) 直连
//
//   endpoint:  POST  https://ark.cn-beijing.volces.com/api/v3/images/generations
//   auth:      Bearer ark-...
//   console:   https://console.volcengine.com/ark
//
// 本文件只用 Web 标准 API（globalThis.fetch / Response / atob 等），
// 同时兼容：Node.js (Vercel Function / Vite dev) 与 V8 isolate (EdgeOne Pages Functions)。
// =======================================================================

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

export interface GenerateEnv {
  JIMENG_API_KEY?: string
  JIMENG_MODEL?: string
  JIMENG_SIZE?: string
  JIMENG_WATERMARK?: string
  JIMENG_BASE_URL?: string
  JIMENG_OPTIMIZE_MODE?: string
  JIMENG_OUTPUT_FORMAT?: string
}

function readEnv(env: GenerateEnv | undefined, key: keyof GenerateEnv): string | undefined {
  if (env && env[key] !== undefined) return env[key]
  if (typeof process !== 'undefined' && process.env) return (process.env as any)[key]
  return undefined
}

/**
 * 参考图角色说明 + 优先级前缀。
 * 把 assists 提升为"强约束"，避免模型"自由发挥"成通用广告片。
 */
function buildIdentityPrefix(groomIdx: number, brideIdx: number): string {
  const faceParts: string[] = []
  if (groomIdx >= 0) faceParts.push(`第${groomIdx + 1}张为新郎本人面部参考`)
  if (brideIdx >= 0) faceParts.push(`第${brideIdx + 1}张为新娘本人面部参考`)
  if (!faceParts.length) return ''

  // 第 1 张到第 groomIdx 张是 assists（如果有的话）
  const hasAssists = groomIdx > 0
  const assistRange = groomIdx === 1 ? '第1张' : groomIdx > 1 ? `第1~${groomIdx}张` : ''

  const sceneBlock = hasAssists
    ? `【场景视觉参考】${assistRange}图片提供本次拍摄的核心视觉模板 —— 必须严格延续：` +
      `服饰款式与材质、姿势与互动动作、背景质感与纹理、光影方向与对比、整体色调与饱和度、` +
      `画面构图与人物在画面中的位置。不要自由发挥成通用婚纱广告片，必须复现参考图的真实拍摄感。\n`
    : ''

  return (
    `【参考图角色说明】\n` +
    sceneBlock +
    `【人脸最高优先级】${faceParts.join('；')}。新郎、新娘的脸必须严格还原这两张图里的真人 —— ` +
    `五官、脸型、眉形、眼距、鼻型、嘴型、肤色、年龄感全部保留，禁止美颜/磨皮/瘦脸/换脸/网红化。\n` +
    (hasAssists
      ? `【优先级排序】人脸还原 > 场景视觉延续 > prompt 文字描述。\n\n`
      : `\n`)
  )
}

async function callOnce(args: {
  refs: string[]
  prompt: string
  apiKey: string
  endpoint: string
  model: string
  size: string
  watermark: boolean
  optimizeMode: string
  outputFormat: string
}): Promise<string> {
  const { refs, prompt, apiKey, endpoint, model, size, watermark, optimizeMode, outputFormat } = args
  const body: Record<string, unknown> = {
    model,
    prompt,
    size,
    sequential_image_generation: 'disabled',
    response_format: 'url',
    stream: false,
    watermark,
  }
  if (/seedream-5/.test(model)) {
    body.output_format = outputFormat
    body.optimize_prompt_options = { mode: optimizeMode }
  }
  if (refs.length) body.image = refs

  const bodyStr = JSON.stringify(body)
  console.log('[jimeng] refs:', refs.length, 'body:', (bodyStr.length / 1024 / 1024).toFixed(2), 'MB',
    'prompt head:', prompt.slice(0, 80).replace(/\s+/g, ' '))

  // 瞬时错误自动重试
  const isTransient = (e: any) => {
    const code = e?.cause?.code || e?.code
    const msg = String(e?.cause?.message || e?.message || '')
    return (
      code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'UND_ERR_SOCKET' ||
      /socket disconnected|socket hang up|terminated|other side closed/i.test(msg)
    )
  }
  let res: Response | undefined
  let lastErr: any
  const MAX_TRIES = 3
  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: bodyStr,
      })
      break
    } catch (e: any) {
      lastErr = e
      if (attempt < MAX_TRIES && isTransient(e)) {
        const backoff = 400 * attempt
        console.warn('[jimeng] transient fetch err (attempt %d/%d), retry in %dms',
          attempt, MAX_TRIES, backoff)
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

/** data: URL 透传；http(s) URL 透传（Ark 自取） */
function toRef(u: string): string {
  return u || ''
}

export async function generate(input: GenerateInput, env?: GenerateEnv): Promise<GenerateOutput> {
  const apiKey = readEnv(env, 'JIMENG_API_KEY')
  if (!apiKey) throw new Error('Missing JIMENG_API_KEY')
  const apiBase = readEnv(env, 'JIMENG_BASE_URL') ?? 'https://ark.cn-beijing.volces.com'
  const model = readEnv(env, 'JIMENG_MODEL') ?? 'doubao-seedream-4-5-251128'
  const size = readEnv(env, 'JIMENG_SIZE') ?? '4K'
  const watermark = (readEnv(env, 'JIMENG_WATERMARK') ?? 'false') === 'true'
  const optimizeMode = readEnv(env, 'JIMENG_OPTIMIZE_MODE') ?? 'standard'
  const outputFormat = readEnv(env, 'JIMENG_OUTPUT_FORMAT') ?? 'png'
  const endpoint = `${apiBase}/api/v3/images/generations`

  const assists = (input.assists ?? []).filter(Boolean)
  const groom = input.groomFace || ''
  const bride = input.brideFace || ''

  const refs = [...assists.map(toRef), ...(groom ? [toRef(groom)] : []), ...(bride ? [toRef(bride)] : [])]
  const groomIdx = groom ? assists.length : -1
  const brideIdx = bride ? assists.length + (groom ? 1 : 0) : -1
  const prompt = buildIdentityPrefix(groomIdx, brideIdx) + input.prompt

  const n = input.n ?? 2

  const settled = await Promise.allSettled(
    Array.from({ length: n }, () => callOnce({
      refs, prompt, apiKey,
      endpoint, model, size, watermark, optimizeMode, outputFormat,
    })),
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
