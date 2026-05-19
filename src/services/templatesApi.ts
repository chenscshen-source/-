// 前端读取模板：从 /api/templates 拉取（替代静态 TS）
import type { Template } from '../types'

interface DbRow {
  id: string
  slug: string
  name: string
  style_en: string | null
  category: string | null
  description: string | null
  cover_url: string | null
  prompt: string
  assists: { url: string; note?: string }[]
  enabled: boolean
  weight: number
}

function rowToTemplate(r: DbRow): Template {
  return {
    id: r.slug,
    name: r.name,
    styleEn: r.style_en ?? '',
    category: (r.category ?? '西式') as Template['category'],
    cover: r.cover_url ?? '',
    description: r.description ?? '',
    prompt: r.prompt,
    sampleResults: [],
    assists: (r.assists ?? []).map(a => a.url),
  }
}

let _cache: Template[] | null = null
let _promise: Promise<Template[]> | null = null

export async function fetchTemplates(force = false): Promise<Template[]> {
  if (!force && _cache) return _cache
  if (_promise && !force) return _promise
  _promise = (async () => {
    const r = await fetch('/api/templates')
    if (!r.ok) throw new Error(`templates ${r.status}`)
    const json = await r.json() as { templates: DbRow[] }
    const list = json.templates.map(rowToTemplate)
    _cache = list
    return list
  })()
  return _promise
}

export function clearTemplatesCache() {
  _cache = null
  _promise = null
}
