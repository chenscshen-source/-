// Postgres 客户端（lazy 单例）—— 兼容 Vercel Prisma Postgres / Neon / 标准 postgres
import postgres from 'postgres'

let _sql: ReturnType<typeof postgres> | null = null

/** 取数据库连接 URL。优先用 NON_POOLING（直连，适合长查询和事务） */
function getDbUrl(): string {
  const url =
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL
  if (!url) throw new Error('Missing database URL env var (POSTGRES_URL / DATABASE_URL)')
  return url
}

export function sql() {
  if (_sql) return _sql
  _sql = postgres(getDbUrl(), {
    // serverless 环境，每次冷启动开个新连接，不要保持多个连接池
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
  })
  return _sql
}

/** 一次性建表。重复运行无副作用（CREATE IF NOT EXISTS） */
export async function ensureSchema() {
  const s = sql()
  await s`
    create table if not exists templates (
      id            uuid primary key default gen_random_uuid(),
      slug          text unique not null,
      name          text not null,
      style_en      text,
      category      text,
      description   text,
      cover_url     text,
      prompt        text not null default '',
      assists       jsonb not null default '[]'::jsonb,
      enabled       boolean not null default true,
      weight        int not null default 0,
      created_at    timestamptz not null default now(),
      updated_at    timestamptz not null default now()
    )
  `
  // 触发器：自动更新 updated_at
  await s`
    create or replace function update_updated_at()
    returns trigger as $$
    begin
      new.updated_at = now();
      return new;
    end;
    $$ language plpgsql
  `
  await s`drop trigger if exists templates_updated_at on templates`
  await s`
    create trigger templates_updated_at
      before update on templates
      for each row execute function update_updated_at()
  `
}
