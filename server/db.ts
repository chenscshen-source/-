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
  // 全局设置表（k-v）
  await s`
    create table if not exists settings (
      key         text primary key,
      value       jsonb not null,
      updated_at  timestamptz not null default now()
    )
  `
  await s`
    create table if not exists invite_codes (
      id            uuid primary key default gen_random_uuid(),
      code          text unique not null,
      note          text,
      max_uses      int not null default 1,
      used_count    int not null default 0,
      expires_at    timestamptz,
      enabled       boolean not null default true,
      created_at    timestamptz not null default now(),
      updated_at    timestamptz not null default now()
    )
  `
  await s`drop trigger if exists invite_codes_updated_at on invite_codes`
  await s`
    create trigger invite_codes_updated_at
      before update on invite_codes
      for each row execute function update_updated_at()
  `
  await s`
    create table if not exists invite_sessions (
      id            uuid primary key default gen_random_uuid(),
      token         text unique not null,
      invite_code_id uuid references invite_codes(id) on delete set null,
      code          text not null,
      created_at    timestamptz not null default now(),
      expires_at    timestamptz not null
    )
  `
  // 默认 prefix 配置（已存在则不覆盖）
  await s`
    insert into settings (key, value) values
      ('prefix_enabled', 'true'::jsonb),
      ('invite_required', 'true'::jsonb),
      ('scene_block', ${'【场景视觉参考】{ASSIST_RANGE}图片提供本次拍摄的核心视觉模板 —— 必须严格延续：服饰款式与材质、姿势与互动动作、背景质感与纹理、光影方向与对比、整体色调与饱和度、画面构图与人物在画面中的位置。不要自由发挥成通用婚纱广告片，必须复现参考图的真实拍摄感。'}::jsonb),
      ('face_block',  ${'【人脸最高优先级】{FACE_PARTS}。新郎、新娘的脸必须严格还原这两张图里的真人 —— 五官、脸型、眉形、眼距、鼻型、嘴型、肤色、年龄感全部保留，禁止美颜/磨皮/瘦脸/换脸/网红化。'}::jsonb),
      ('priority_block', ${'【优先级排序】人脸还原 > 场景视觉延续 > prompt 文字描述。'}::jsonb)
    on conflict (key) do nothing
  `
}
