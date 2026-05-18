import type { Template } from '../types'
import type { ResultGroup } from '../store'

export interface BatchProgress {
  /** 当前正在处理的模板序号（1-based）；done=true 时为总数 */
  current: number
  /** 模板总数 */
  total: number
  /** 当前模板名 */
  templateName: string
  /** 滚动文案：正在做什么 */
  stage: string
  /** 总体进度百分比（0-100，按实际耗时估算） */
  percent: number
  /** 预计剩余秒数（基于实际已用时长 + 单模板均时） */
  etaSeconds: number
  /** 是否已全部完成 */
  done: boolean
}

const stages = [
  '正在识别面部特征',
  '正在分析模板风格',
  '正在融合婚纱场景',
  '正在精修光影细节',
  '正在生成高清成片',
]

/** 单模板预估耗时（秒）。4K + 3 张并发的 seedream 实测在 2-3 分钟。 */
const PER_TEMPLATE_SECONDS = 180

async function generateOne(
  tpl: Template,
  groomFace: string,
  brideFace: string,
): Promise<string[]> {
  const abs = (u: string) => new URL(u, window.location.origin).toString()
  const body = JSON.stringify({
    prompt: tpl.prompt,
    assists: (tpl.assists ?? []).map(abs),
    groomFace,
    brideFace,
    n: 3,
  })
  console.log('[generate] body=%s KB (groom=%s KB, bride=%s KB)',
    Math.round(body.length / 1024),
    Math.round(groomFace.length / 1024),
    Math.round(brideFace.length / 1024))
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    // 后端把 upstream 的错误 JSON 整段塞回来，尝试抽出可读 message
    let readable = txt
    try {
      const j = JSON.parse(txt)
      readable = j.error ?? j.message ?? txt
      const m = /seedream \d+: (\{.*\})/s.exec(readable)
      if (m) {
        const inner = JSON.parse(m[1])
        readable = inner?.error?.message ?? readable
      }
    } catch {/* keep raw */}
    throw new Error(readable)
  }
  const json = await res.json() as { images: string[] }
  return json.images
}

/** 单模板的预估总时长（秒），可被 UI 调用做"约 N 分钟"的提示 */
export function estimateTotalSeconds(templateCount: number): number {
  return templateCount * PER_TEMPLATE_SECONDS
}

export async function generateBatch(
  templates: Template[],
  groomFace: string,
  brideFace: string,
  onProgress?: (p: BatchProgress) => void,
): Promise<ResultGroup[]> {
  const results: ResultGroup[] = []
  const total = templates.length
  const batchStart = Date.now()
  const totalEstimate = total * PER_TEMPLATE_SECONDS

  for (let i = 0; i < total; i++) {
    const tpl = templates[i]
    const tplStart = Date.now()
    let stageIdx = 0
    let stop = false

    // 滚动文案 + 基于时间的真实进度（旧版按 stage 算 percent 会循环回退）
    const ticker = setInterval(() => {
      if (stop) return
      const elapsedTotal = (Date.now() - batchStart) / 1000
      const elapsedLocal = (Date.now() - tplStart) / 1000
      // 当前模板在自己时间窗口内的占比，封顶 0.95 避免提前到 100%
      const localPct = Math.min(elapsedLocal / PER_TEMPLATE_SECONDS, 0.95)
      const overall = Math.min(Math.round(((i + localPct) / total) * 100), 95)
      const etaSeconds = Math.max(Math.round(totalEstimate - elapsedTotal), 0)
      onProgress?.({
        current: i + 1,
        total,
        templateName: tpl.name,
        stage: stages[stageIdx],
        percent: overall,
        etaSeconds,
        done: false,
      })
      stageIdx = (stageIdx + 1) % stages.length
    }, 900)

    try {
      const images = await generateOne(tpl, groomFace, brideFace)
      results.push({ template: tpl, images })
    } finally {
      stop = true
      clearInterval(ticker)
    }

    onProgress?.({
      current: i + 1,
      total,
      templateName: tpl.name,
      stage: '完成',
      percent: Math.min(Math.round(((i + 1) / total) * 100), 99),
      etaSeconds: Math.max(Math.round(totalEstimate - (Date.now() - batchStart) / 1000), 0),
      done: false,
    })
  }

  onProgress?.({
    current: total, total, templateName: '',
    stage: '完成', percent: 100, etaSeconds: 0, done: true,
  })
  return results
}
