// templates 表的 CRUD 封装
import { sql } from './db.js'

export interface AssistRef {
  url: string
  note?: string
}

export interface TemplateRow {
  id: string
  slug: string
  name: string
  style_en: string | null
  category: string | null
  description: string | null
  cover_url: string | null
  prompt: string
  assists: AssistRef[]
  enabled: boolean
  weight: number
  created_at: string
  updated_at: string
}

/** 按 weight 倒序、created_at 升序返回（admin 看全部，前台看 enabled） */
export async function listTemplates(opts: { onlyEnabled?: boolean } = {}): Promise<TemplateRow[]> {
  const s = sql()
  if (opts.onlyEnabled) {
    return await s<TemplateRow[]>`
      select * from templates
      where enabled = true
      order by weight desc, created_at asc
    `
  }
  return await s<TemplateRow[]>`
    select * from templates
    order by weight desc, created_at asc
  `
}

export async function getTemplate(id: string): Promise<TemplateRow | null> {
  const s = sql()
  const rows = await s<TemplateRow[]>`select * from templates where id = ${id} limit 1`
  return rows[0] ?? null
}

export async function createTemplate(data: Partial<TemplateRow> & { slug: string; name: string }): Promise<TemplateRow> {
  const s = sql()
  const rows = await s<TemplateRow[]>`
    insert into templates (slug, name, style_en, category, description, cover_url, prompt, assists, enabled, weight)
    values (
      ${data.slug},
      ${data.name},
      ${data.style_en ?? null},
      ${data.category ?? null},
      ${data.description ?? null},
      ${data.cover_url ?? null},
      ${data.prompt ?? ''},
      ${s.json(data.assists ?? [])},
      ${data.enabled ?? true},
      ${data.weight ?? 0}
    )
    returning *
  `
  return rows[0]
}

export async function updateTemplate(id: string, data: Partial<TemplateRow>): Promise<TemplateRow | null> {
  const s = sql()
  // 只更新传入的字段，未传的保持原值
  const patch: Record<string, unknown> = {}
  if (data.slug !== undefined) patch.slug = data.slug
  if (data.name !== undefined) patch.name = data.name
  if (data.style_en !== undefined) patch.style_en = data.style_en
  if (data.category !== undefined) patch.category = data.category
  if (data.description !== undefined) patch.description = data.description
  if (data.cover_url !== undefined) patch.cover_url = data.cover_url
  if (data.prompt !== undefined) patch.prompt = data.prompt
  if (data.assists !== undefined) patch.assists = s.json(data.assists as any)
  if (data.enabled !== undefined) patch.enabled = data.enabled
  if (data.weight !== undefined) patch.weight = data.weight

  if (Object.keys(patch).length === 0) {
    return getTemplate(id)
  }
  const rows = await s<TemplateRow[]>`
    update templates set ${s(patch)}
    where id = ${id}
    returning *
  `
  return rows[0] ?? null
}

export async function deleteTemplate(id: string): Promise<boolean> {
  const s = sql()
  const rows = await s`delete from templates where id = ${id} returning id`
  return rows.length > 0
}

export async function countTemplates(): Promise<number> {
  const s = sql()
  const rows = await s<{ count: string }[]>`select count(*) as count from templates`
  return Number(rows[0]?.count ?? 0)
}
