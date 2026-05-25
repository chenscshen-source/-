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

export default function AdminListPage() {
  const [rows, setRows] = useState<AdminRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [batchFiles, setBatchFiles] = useState<File[]>([])
  const [batchUploading, setBatchUploading] = useState(false)
  const [batchDone, setBatchDone] = useState(0)
  const [batchTotal, setBatchTotal] = useState(0)
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
    if (batchFiles.length === 0) {
      alert('请先选择要批量上传的封面图')
      return
    }
    setBatchUploading(true)
    setBatchDone(0)
    setBatchTotal(batchFiles.length)
    try {
      const maxWeight = rows.reduce((n, r) => Math.max(n, r.weight ?? 0), 0)
      const stamp = Date.now()
      const errors: string[] = []
      for (let i = 0; i < batchFiles.length; i++) {
        const file = batchFiles[i]
        try {
          const title = inferTitle(file.name, i)
          const category = classifyFromName(title)
          const coverUrl = await uploadFile(file, `cover-${stamp}-${i + 1}.jpg`)
          const safeSlug = `${slugifyFilename(file.name)}-${(stamp + i).toString(36)}`
          const payload = {
            slug: safeSlug,
            name: title,
            style_en: styleFromCategory(category),
            category,
            description: '',
            cover_url: coverUrl,
            prompt: '',
            assists: [],
            enabled: true,
            weight: maxWeight + (batchFiles.length - i),
          }
          const r = await fetch('/api/admin/templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
          if (!r.ok) throw new Error(`create ${r.status}`)
        } catch (e: any) {
          errors.push(`${file.name}: ${String(e?.message ?? e)}`)
        } finally {
          setBatchDone(i + 1)
        }
      }
      await load()
      setBatchFiles([])
      if (errors.length) {
        alert(`批量上传完成，但有 ${errors.length} 项失败：\n${errors.slice(0, 5).join('\n')}`)
      } else {
        alert(`批量上传成功，共创建 ${batchTotal || batchFiles.length} 个模板`)
      }
    } finally {
      setBatchUploading(false)
    }
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
          一次选择多张封面图即可。系统会自动识别并填好标题、分类、英文风格、Slug 与权重。
        </p>
        <div className="admin-batch-actions">
          <label className="admin-btn admin-btn--ghost">
            选择封面图（可多选）
            <input
              type="file"
              accept="image/*"
              multiple
              hidden
              disabled={batchUploading}
              onChange={e => setBatchFiles(Array.from(e.target.files ?? []))}
            />
          </label>
          <button className="admin-btn" disabled={batchUploading || batchFiles.length === 0} onClick={bulkCreate}>
            {batchUploading ? `上传中 ${batchDone}/${batchTotal}` : `开始批量上传（${batchFiles.length}）`}
          </button>
        </div>
        {batchFiles.length > 0 && (
          <div className="admin-batch-files">
            已选 {batchFiles.length} 张：{batchFiles.slice(0, 8).map(f => f.name).join('，')}
            {batchFiles.length > 8 ? ` 等 ${batchFiles.length} 个文件` : ''}
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
