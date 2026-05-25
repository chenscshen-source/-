import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

interface AdminRow {
  id: string
  slug: string
  name: string
  style_en: string | null
  category: string | null
  cover_url: string | null
  enabled: boolean
  weight: number
  assists: { url: string }[]
}

interface FolderTemplateItem {
  key: string
  folderName: string
  coverFile: File | null
  promptFile: File | null
  assistFiles: File[]
}

async function compressFile(file: File, maxDim = 1200, quality = 0.85): Promise<string> {
  const objURL = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = reject
      i.src = objURL
    })
    let { width, height } = img
    const long = Math.max(width, height)
    if (long > maxDim) {
      const r = maxDim / long
      width = Math.round(width * r)
      height = Math.round(height * r)
    }
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, width, height)
    return canvas.toDataURL('image/jpeg', quality)
  } finally {
    URL.revokeObjectURL(objURL)
  }
}

async function uploadFile(file: File, filename: string): Promise<string> {
  const dataUrl = await compressFile(file)
  const r = await fetch('/api/admin/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, dataUrl }),
  })
  if (!r.ok) throw new Error(`upload ${r.status}`)
  const j = await r.json() as { url: string }
  return j.url
}

function slugifyFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, '')
  const normalized = base
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
  return normalized || `tpl-${Date.now()}`
}

function classifyFromName(name: string): string {
  const s = name.toLowerCase()
  if (s.includes('中式') || s.includes('秀禾') || s.includes('汉服') || s.includes('旗袍')) return '中式'
  if (s.includes('旅拍') || s.includes('海边') || s.includes('草地') || s.includes('外景')) return '旅拍'
  if (s.includes('复古') || s.includes('油画') || s.includes('港风') || s.includes('胶片')) return '复古'
  return '西式'
}

function styleFromCategory(category: string): string {
  if (category === '中式') return 'Oriental Elegance'
  if (category === '旅拍') return 'Travel Romance'
  if (category === '复古') return 'Vintage Story'
  return 'Classic Light'
}

function inferTitle(filename: string, index: number): string {
  const base = filename.replace(/\.[^.]+$/, '')
  const cleaned = base
    .replace(/^img[_-\s]?\d+$/i, '')
    .replace(/^image[_-\s]?\d+$/i, '')
    .replace(/^dsc[_-\s]?\d+$/i, '')
    .replace(/^wechatimg[_-\s]?\d+$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim()
  return cleaned || `模版${index + 1}`
}

function isImageFile(name: string): boolean {
  return /\.(png|jpe?g|webp|gif|bmp|heic|heif)$/i.test(name)
}

function isPromptFile(name: string): boolean {
  return /\.(txt|md|markdown|json|text|doc|docx)$/i.test(name)
}

function classifyBucket(folderName: string): 'cover' | 'prompt' | 'assist' | null {
  const n = folderName.toLowerCase()
  if (n.includes('模版') || n.includes('模板') || n.includes('封面')) return 'cover'
  if (n.includes('提示词') || n.includes('prompt')) return 'prompt'
  if (n.includes('参考图') || n.includes('参考') || n.includes('assist')) return 'assist'
  return null
}

function fallbackPrompt(title: string, category: string): string {
  return `婚纱摄影风格片，主题「${title}」，分类「${category}」。保留人物五官与面部特征一致，服饰与场景风格统一，构图自然，光影细腻，画质清晰，整体高级简约。`
}

async function readPromptContent(file: File | null): Promise<string> {
  if (!file) return ''
  if (/\.(txt|md|markdown|json|text)$/i.test(file.name)) {
    return (await file.text()).trim()
  }
  // doc/docx 当前不做结构化解析，避免读取到二进制乱码
  return ''
}

function buildFolderTemplates(files: File[]): FolderTemplateItem[] {
  const grouped = new Map<string, FolderTemplateItem>()
  for (const file of files) {
    const rel = ((file as any).webkitRelativePath || (file as any).__relPath) as string | undefined
    if (!rel) continue
    const parts = rel.split('/').filter(Boolean)
    if (parts.length < 3) continue
    const templateKey = parts.slice(0, -2).join('/')
    const templateFolderName = parts[parts.length - 3]
    const bucketFolderName = parts[parts.length - 2]
    const bucket = classifyBucket(bucketFolderName)
    if (!bucket) continue
    const cur = grouped.get(templateKey) ?? {
      key: templateKey,
      folderName: templateFolderName,
      coverFile: null,
      promptFile: null,
      assistFiles: [],
    }
    if (bucket === 'cover' && !cur.coverFile && isImageFile(file.name)) cur.coverFile = file
    if (bucket === 'prompt' && !cur.promptFile && isPromptFile(file.name)) cur.promptFile = file
    if (bucket === 'assist' && isImageFile(file.name)) cur.assistFiles.push(file)
    grouped.set(templateKey, cur)
  }
  return Array.from(grouped.values()).filter(item => item.coverFile)
}

function readEntry(entry: any, parentPath: string): Promise<File[]> {
  return new Promise((resolve) => {
    if (entry.isFile) {
      entry.file((file: File) => {
        const relPath = `${parentPath}${file.name}`
        Object.defineProperty(file, '__relPath', { value: relPath, configurable: true })
        resolve([file])
      }, () => resolve([]))
      return
    }
    if (entry.isDirectory) {
      const reader = entry.createReader()
      const readAll = async (): Promise<any[]> => {
        const out: any[] = []
        while (true) {
          const chunk = await new Promise<any[]>((res) => reader.readEntries(res, () => res([])))
          if (!chunk.length) break
          out.push(...chunk)
        }
        return out
      }
      readAll()
        .then(async (entries) => {
          const children = await Promise.all(entries.map((child) => readEntry(child, `${parentPath}${entry.name}/`)))
          resolve(children.flat())
        })
        .catch(() => resolve([]))
      return
    }
    resolve([])
  })
}

async function readDroppedFolders(event: React.DragEvent<HTMLDivElement>): Promise<File[]> {
  const items = Array.from(event.dataTransfer.items || [])
  const entries = items
    .map((it) => (it as any).webkitGetAsEntry?.())
    .filter(Boolean)
    .filter((entry: any) => entry.isDirectory)
  if (!entries.length) return []
  const groups = await Promise.all(entries.map((entry: any) => readEntry(entry, '')))
  return groups.flat()
}

export default function AdminListPage() {
  const [rows, setRows] = useState<AdminRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [batchFiles, setBatchFiles] = useState<File[]>([])
  const [batchItems, setBatchItems] = useState<FolderTemplateItem[]>([])
  const [batchUploading, setBatchUploading] = useState(false)
  const [batchDone, setBatchDone] = useState(0)
  const [batchTotal, setBatchTotal] = useState(0)
  const [dragActive, setDragActive] = useState(false)
  const navigate = useNavigate()

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/templates')
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const j = await r.json() as { templates: AdminRow[] }
      setRows(j.templates)
      setError(null)
    } catch (e: any) {
      setError(String(e?.message ?? e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const toggleEnabled = async (row: AdminRow) => {
    const next = !row.enabled
    setRows(rs => rs.map(r => r.id === row.id ? { ...r, enabled: next } : r))
    try {
      await fetch(`/api/admin/templates/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      })
    } catch {
      // 回滚
      setRows(rs => rs.map(r => r.id === row.id ? { ...r, enabled: !next } : r))
      alert('切换失败')
    }
  }

  const remove = async (row: AdminRow) => {
    if (!confirm(`确定删除模板「${row.name}」？此操作不可恢复。`)) return
    try {
      const r = await fetch(`/api/admin/templates/${row.id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      setRows(rs => rs.filter(x => x.id !== row.id))
    } catch (e: any) {
      alert('删除失败：' + String(e?.message ?? e))
    }
  }

  const bulkCreate = async () => {
    if (batchItems.length === 0) {
      alert('请先选择包含“模版/提示词/参考图”的文件夹')
      return
    }
    setBatchUploading(true)
    setBatchDone(0)
    setBatchTotal(batchItems.length)
    try {
      const maxWeight = rows.reduce((n, r) => Math.max(n, r.weight ?? 0), 0)
      const stamp = Date.now()
      const errors: string[] = []
      for (let i = 0; i < batchItems.length; i++) {
        const item = batchItems[i]
        try {
          const title = inferTitle(item.folderName, i)
          const category = classifyFromName(title)
          const coverFile = item.coverFile!
          const coverUrl = await uploadFile(coverFile, `cover-${stamp}-${i + 1}.jpg`)
          const assistUrls: { url: string }[] = []
          for (let j = 0; j < item.assistFiles.length; j++) {
            const assistUrl = await uploadFile(item.assistFiles[j], `assist-${stamp}-${i + 1}-${j + 1}.jpg`)
            assistUrls.push({ url: assistUrl })
          }
          const safeSlug = `${slugifyFilename(item.folderName)}-${(stamp + i).toString(36)}`
          const promptRaw = await readPromptContent(item.promptFile)
          const prompt = promptRaw || fallbackPrompt(title, category)
          const payload = {
            slug: safeSlug,
            name: title,
            style_en: styleFromCategory(category),
            category,
            description: '',
            cover_url: coverUrl,
            prompt,
            assists: assistUrls,
            enabled: true,
            weight: maxWeight + (batchItems.length - i),
          }
          const r = await fetch('/api/admin/templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
          if (!r.ok) throw new Error(`create ${r.status}`)
        } catch (e: any) {
          errors.push(`${item.folderName}: ${String(e?.message ?? e)}`)
        } finally {
          setBatchDone(i + 1)
        }
      }
      await load()
      setBatchFiles([])
      setBatchItems([])
      if (errors.length) {
        alert(`批量上传完成，但有 ${errors.length} 项失败：\n${errors.slice(0, 5).join('\n')}`)
      } else {
        alert(`批量上传成功，共创建 ${batchTotal || batchItems.length} 个模板`)
      }
    } finally {
      setBatchUploading(false)
    }
  }

  const onDropFolders = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragActive(false)
    if (batchUploading) return
    const files = await readDroppedFolders(event)
    if (!files.length) {
      alert('请拖入一个或多个模板文件夹（每个文件夹需包含 模版/提示词/参考图）')
      return
    }
    setBatchFiles(files)
    setBatchItems(buildFolderTemplates(files))
  }

  return (
    <div className="admin-wrap">
      <header className="admin-head">
        <div>
          <div className="admin-eyebrow">Admin</div>
          <h1 className="admin-title">模板管理</h1>
        </div>
        <div className="admin-actions">
          <Link to="/templates" className="admin-link">← 返回前台</Link>
          <Link to="/admin/invites" className="admin-link">邀请码管理</Link>
          <Link to="/admin/settings" className="admin-link">Prompt 前缀设置</Link>
          <button className="admin-btn" onClick={() => navigate('/admin/templates/new')}>+ 新建模板</button>
        </div>
      </header>

      {loading && <div className="admin-empty">加载中…</div>}
      {error && <div className="admin-empty admin-empty--err">出错：{error}</div>}
      {!loading && !error && rows.length === 0 && (
        <div className="admin-empty">
          数据库还没有模板。先访问 <code>/api/admin/init</code> 建表，
          再访问 <code>/api/admin/seed</code> 把现有 11 个模板灌进来。
        </div>
      )}

      <section className="admin-section admin-batch">
        <h3 className="admin-section-title">批量上传模板</h3>
        <p className="admin-hint">
          支持一次上传多个模板文件夹。每个模板文件夹需包含 3 个子文件夹：<code>模版</code>、<code>提示词</code>、<code>参考图</code>。
          <br />
          提示词建议放 <code>.txt / .md / .json</code> 文本文件；若为空或无法识别，系统会自动生成兜底提示词。
        </p>
        <div
          className={`admin-dropzone${dragActive ? ' admin-dropzone--active' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragActive(true) }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDropFolders}
        >
          把多个模板文件夹直接拖到这里
        </div>
        <div className="admin-batch-actions">
          <label className="admin-btn admin-btn--ghost">
            选择父目录（备选）
            <input
              type="file"
              multiple
              hidden
              disabled={batchUploading}
              {...({ webkitdirectory: 'true', directory: 'true' } as any)}
              onChange={e => {
                const files = Array.from(e.target.files ?? [])
                setBatchFiles(files)
                setBatchItems(buildFolderTemplates(files))
              }}
            />
          </label>
          <button className="admin-btn" disabled={batchUploading || batchItems.length === 0} onClick={bulkCreate}>
            {batchUploading ? `上传中 ${batchDone}/${batchTotal}` : `开始批量上传（${batchItems.length}）`}
          </button>
        </div>
        {batchFiles.length > 0 && (
          <div className="admin-batch-files">
            已读取 {batchFiles.length} 个文件，识别到 {batchItems.length} 个模板文件夹
            {batchItems.length > 0 ? `：${batchItems.slice(0, 6).map(item => item.folderName).join('，')}` : ''}
            {batchItems.length > 6 ? ` 等 ${batchItems.length} 个` : ''}
          </div>
        )}
      </section>

      {!loading && rows.length > 0 && (
        <table className="admin-table">
          <thead>
            <tr>
              <th>封面</th>
              <th>名称</th>
              <th>分类</th>
              <th>权重</th>
              <th>参考图</th>
              <th>上架</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id} className={row.enabled ? '' : 'admin-row--off'}>
                <td>
                  {row.cover_url
                    ? <img src={row.cover_url} alt="" className="admin-thumb" />
                    : <div className="admin-thumb admin-thumb--empty">无</div>}
                </td>
                <td>
                  <div className="admin-name">{row.name}</div>
                  <div className="admin-sub">{row.style_en} · {row.slug}</div>
                </td>
                <td>{row.category ?? '—'}</td>
                <td>{row.weight}</td>
                <td>{row.assists?.length ?? 0} 张</td>
                <td>
                  <label className="admin-switch">
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      onChange={() => toggleEnabled(row)}
                    />
                    <span />
                  </label>
                </td>
                <td className="admin-row-actions">
                  <Link to={`/admin/templates/${row.id}`}>编辑</Link>
                  <button onClick={() => remove(row)} className="admin-danger">删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
