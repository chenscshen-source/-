// 全局设置 k-v 仓库
import { sql } from './db.js'

export interface PromptPrefixSettings {
  prefix_enabled: boolean
  scene_block: string
  face_block: string
  priority_block: string
}

const DEFAULTS: PromptPrefixSettings = {
  prefix_enabled: true,
  scene_block:
    '【场景视觉参考】{ASSIST_RANGE}图片提供本次拍摄的核心视觉模板 —— 必须严格延续：' +
    '服饰款式与材质、姿势与互动动作、背景质感与纹理、光影方向与对比、整体色调与饱和度、' +
    '画面构图与人物在画面中的位置。不要自由发挥成通用婚纱广告片，必须复现参考图的真实拍摄感。',
  face_block:
    '【人脸最高优先级】{FACE_PARTS}。新郎、新娘的脸必须严格还原这两张图里的真人 —— ' +
    '五官、脸型、眉形、眼距、鼻型、嘴型、肤色、年龄感全部保留，禁止美颜/磨皮/瘦脸/换脸/网红化。',
  priority_block: '【优先级排序】人脸还原 > 场景视觉延续 > prompt 文字描述。',
}

/** 读取全部 prefix 相关设置；DB 没记录的字段用默认值 */
export async function getPrefixSettings(): Promise<PromptPrefixSettings> {
  try {
    const s = sql()
    const rows = await s<{ key: string; value: any }[]>`
      select key, value from settings
      where key in ('prefix_enabled', 'scene_block', 'face_block', 'priority_block')
    `
    const out: PromptPrefixSettings = { ...DEFAULTS }
    for (const r of rows) {
      if (r.key === 'prefix_enabled') out.prefix_enabled = !!r.value
      else if (r.key === 'scene_block') out.scene_block = String(r.value)
      else if (r.key === 'face_block') out.face_block = String(r.value)
      else if (r.key === 'priority_block') out.priority_block = String(r.value)
    }
    return out
  } catch (e) {
    console.warn('[settings] read failed, using defaults:', e)
    return DEFAULTS
  }
}

/** 写一个或多个 key 值（jsonb upsert） */
export async function updatePrefixSettings(patch: Partial<PromptPrefixSettings>) {
  const s = sql()
  const entries: { key: string; value: any }[] = []
  if (patch.prefix_enabled !== undefined) entries.push({ key: 'prefix_enabled', value: patch.prefix_enabled })
  if (patch.scene_block !== undefined) entries.push({ key: 'scene_block', value: patch.scene_block })
  if (patch.face_block !== undefined) entries.push({ key: 'face_block', value: patch.face_block })
  if (patch.priority_block !== undefined) entries.push({ key: 'priority_block', value: patch.priority_block })

  for (const e of entries) {
    await s`
      insert into settings (key, value) values (${e.key}, ${s.json(e.value as any)})
      on conflict (key) do update set value = excluded.value, updated_at = now()
    `
  }
  return getPrefixSettings()
}

export { DEFAULTS as PREFIX_DEFAULTS }
