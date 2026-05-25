import { sql } from './db.js'

export interface InviteCodeRow {
  id: string
  code: string
  note: string | null
  max_uses: number
  used_count: number
  expires_at: string | null
  enabled: boolean
  created_at: string
  updated_at: string
}

export async function isInviteRequired(): Promise<boolean> {
  const s = sql()
  const rows = await s<{ value: boolean }[]>`
    select value::text::boolean as value from settings where key = 'invite_required' limit 1
  `
  return rows[0]?.value ?? true
}

export async function setInviteRequired(enabled: boolean): Promise<void> {
  const s = sql()
  await s`
    insert into settings (key, value)
    values ('invite_required', ${JSON.stringify(enabled)}::jsonb)
    on conflict (key) do update set value = excluded.value, updated_at = now()
  `
}

export async function listInviteCodes(): Promise<InviteCodeRow[]> {
  const s = sql()
  return s<InviteCodeRow[]>`select * from invite_codes order by created_at desc`
}

export async function createInviteCode(input: {
  code: string
  note?: string
  max_uses?: number
  expires_at?: string | null
}): Promise<InviteCodeRow> {
  const s = sql()
  const rows = await s<InviteCodeRow[]>`
    insert into invite_codes (code, note, max_uses, expires_at, enabled)
    values (
      ${input.code.trim()},
      ${input.note?.trim() || null},
      ${Math.max(1, input.max_uses ?? 1)},
      ${input.expires_at || null},
      true
    )
    returning *
  `
  return rows[0]
}

export async function updateInviteCode(id: string, patch: Partial<InviteCodeRow>): Promise<InviteCodeRow | null> {
  const s = sql()
  const next: Record<string, unknown> = {}
  if (patch.note !== undefined) next.note = patch.note
  if (patch.max_uses !== undefined) next.max_uses = Math.max(1, Number(patch.max_uses || 1))
  if (patch.expires_at !== undefined) next.expires_at = patch.expires_at
  if (patch.enabled !== undefined) next.enabled = patch.enabled
  if (!Object.keys(next).length) return null
  const rows = await s<InviteCodeRow[]>`
    update invite_codes set ${s(next)} where id = ${id} returning *
  `
  return rows[0] ?? null
}

export async function deleteInviteCode(id: string): Promise<boolean> {
  const s = sql()
  const rows = await s`delete from invite_codes where id = ${id} returning id`
  return rows.length > 0
}

export async function verifyInviteCodeAndCreateSession(code: string): Promise<{ token: string; expiresAt: string } | null> {
  const s = sql()
  const clean = code.trim()
  if (!clean) return null
  const rows = await s<InviteCodeRow[]>`
    select * from invite_codes
    where code = ${clean}
      and enabled = true
      and (expires_at is null or expires_at > now())
      and used_count < max_uses
    limit 1
  `
  const row = rows[0]
  if (!row) return null
  const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
  const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()
  await s.begin(async tx => {
    await tx`update invite_codes set used_count = used_count + 1 where id = ${row.id}`
    await tx`
      insert into invite_sessions (token, invite_code_id, code, expires_at)
      values (${token}, ${row.id}, ${row.code}, ${expiresAt})
    `
  })
  return { token, expiresAt }
}

export async function isInviteSessionValid(token: string): Promise<boolean> {
  const s = sql()
  const rows = await s<{ ok: boolean }[]>`
    select true as ok
    from invite_sessions
    where token = ${token}
      and expires_at > now()
    limit 1
  `
  return !!rows[0]?.ok
}
