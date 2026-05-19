// 一次性 seed：把 src/data/templates.ts + prompts.ts 里的 11 个模板灌进 DB
// 同时把 public/templates/{n}.jpg + public/assets/{n}/* 通过 fetch 拷贝到 Blob
// 调用：POST /api/admin/seed  （只在表为空时插，重复调用幂等）
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { put } from '@vercel/blob'
import { ensureSchema } from '../../server/db.js'
import { countTemplates, createTemplate } from '../../server/templatesRepo.js'
import { templates as staticTemplates } from '../../src/data/templates.js'

async function uploadFromUrl(url: string, dest: string): Promise<string> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`fetch ${url} -> ${r.status}`)
  const buf = Buffer.from(await r.arrayBuffer())
  const contentType = r.headers.get('content-type') ?? 'image/jpeg'
  const { url: blobUrl } = await put(dest, buf, {
    access: 'public',
    contentType,
    allowOverwrite: true,
  })
  return blobUrl
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await ensureSchema()
    const existing = await countTemplates()
    if (existing > 0 && req.query.force !== '1') {
      res.status(200).json({
        ok: true, skipped: true,
        message: `Already has ${existing} templates. Use ?force=1 to re-seed.`,
      })
      return
    }

    // 从生产站点拉静态资源到 Blob
    const baseUrl = `https://${req.headers.host}`
    const inserted: any[] = []
    let idx = 0
    for (const tpl of staticTemplates) {
      idx++
      console.log(`[seed] ${idx}/${staticTemplates.length} ${tpl.name}`)
      // 把模板 id 里数字部分抽出来对应 /templates/{n} 路径
      const n = parseInt(tpl.id.replace(/\D/g, ''), 10)
      // 上传封面
      const coverSrc = `${baseUrl}${tpl.cover}` // tpl.cover = "/templates/1.jpg"
      const coverBlobUrl = await uploadFromUrl(coverSrc, `templates/${n}/cover.jpg`)
      // 上传 assists
      const assistsBlobUrls: { url: string; note?: string }[] = []
      const assists = (tpl as any).assists as string[] | undefined
      if (assists) {
        let j = 0
        for (const a of assists) {
          j++
          const ext = (a.match(/\.([a-zA-Z0-9]+)$/) ?? [, 'jpg'])[1]
          const blobUrl = await uploadFromUrl(`${baseUrl}${a}`, `templates/${n}/assist-${j}.${ext}`)
          assistsBlobUrls.push({ url: blobUrl })
        }
      }
      const row = await createTemplate({
        slug: tpl.id,
        name: tpl.name,
        style_en: tpl.styleEn,
        category: tpl.category,
        description: tpl.description,
        cover_url: coverBlobUrl,
        prompt: tpl.prompt,
        assists: assistsBlobUrls,
        enabled: true,
        weight: staticTemplates.length - idx, // 保持原顺序
      })
      inserted.push({ name: row.name, id: row.id })
    }
    res.status(200).json({ ok: true, count: inserted.length, inserted })
  } catch (e: any) {
    console.error('[/api/admin/seed]', e)
    res.status(500).json({ error: String(e?.message ?? e) })
  }
}

export const config = { maxDuration: 300 }
