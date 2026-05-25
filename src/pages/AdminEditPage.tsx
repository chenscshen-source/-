import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

interface AssistRef { url: string; note?: string }

interface FormState {
  slug: string
  name: string
  style_en: string
  category: string
  description: string
  cover_url: string
  prompt: string
  assists: AssistRef[]
  enabled: boolean
  weight: number
}

const EMPTY: FormState = {
  slug: '',
  name: '',
  style_en: '',
  category: '西式',
  description: '',
  cover_url: '',
  prompt: '',
  assists: [],
  enabled: true,
  weight: 0,
}

function classifyFromName(name: string): FormState['category'] {
  const s = name.toLowerCase()
  if (s.includes('中式') || s.includes('秀禾') || s.includes('汉服') || s.includes('旗袍')) return '中式'
  if (s.includes('旅拍') || s.includes('海边') || s.includes('草地') || s.includes('外景')) return '旅拍'
  if (s.includes('复古') || s.includes('油画') || s.includes('港风') || s.includes('胶片')) return '复古'
  return '西式'
}

function styleFromCategory(category: FormState['category']): string {
  if (category === '中式') return 'Oriental Elegance'
  if (category === '旅拍') return 'Travel Romance'
  if (category === '复古') return 'Vintage Story'
  return 'Classic Light'
}

function makeSlug(name: string): string {
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
  return normalized || `tpl-${Date.now().toString(36)}`
}

/** 浏览器端压到 1200 长边 + jpeg q85，再 base64，避免上传过大 */
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

export default function AdminEditPage() {
  const { id } = useParams<{ id?: string }>()
  const isNew = !id
  const [form, setForm] = useState<FormState>(EMPTY)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [coverUploading, setCoverUploading] = useState(false)
  const [assistUploading, setAssistUploading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (isNew) {
      fetch('/api/admin/templates')
        .then(r => r.json())
        .then(j => {
          const rows = (j.templates ?? []) as Array<{ weight?: number }>
          const maxWeight = rows.reduce((n, row) => Math.max(n, Number(row.weight ?? 0)), 0)
          setForm(f => ({ ...f, weight: maxWeight + 1 }))
        })
        .catch(() => {})
      return
    }
    fetch(`/api/admin/templates/${id}`)
      .then(r => r.json())
      .then(j => {
        const t = j.template
        setForm({
          slug: t.slug,
          name: t.name,
          style_en: t.style_en ?? '',
          category: t.category ?? '西式',
          description: t.description ?? '',
          cover_url: t.cover_url ?? '',
          prompt: t.prompt ?? '',
          assists: t.assists ?? [],
          enabled: !!t.enabled,
          weight: t.weight ?? 0,
        })
      })
      .catch(e => alert('加载失败：' + e.message))
      .finally(() => setLoading(false))
  }, [id, isNew])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({ ...f, [k]: v }))

  const onCover = async (file: File) => {
    setCoverUploading(true)
    try {
      const url = await uploadFile(file, `cover-${Date.now()}.jpg`)
      const basename = file.name.replace(/\.[^.]+$/, '')
      const nextCategory = classifyFromName(basename)
      setForm(f => ({
        ...f,
        cover_url: url,
        name: f.name.trim() ? f.name : basename,
        slug: f.slug.trim() ? f.slug : makeSlug(basename),
        category: f.category === '西式' && !f.name.trim() ? nextCategory : f.category,
        style_en: f.style_en.trim() ? f.style_en : styleFromCategory(nextCategory),
      }))
    } catch (e: any) {
      alert('上传失败：' + e.message)
    } finally {
      setCoverUploading(false)
    }
  }

  const onAddAssists = async (files: FileList) => {
    setAssistUploading(true)
    try {
      const uploaded: AssistRef[] = []
      for (const f of Array.from(files)) {
        const url = await uploadFile(f, `assist-${Date.now()}.jpg`)
        uploaded.push({ url })
      }
      set('assists', [...form.assists, ...uploaded])
    } catch (e: any) {
      alert('上传失败：' + e.message)
    } finally {
      setAssistUploading(false)
    }
  }

  const removeAssist = (i: number) => set('assists', form.assists.filter((_, idx) => idx !== i))
  const moveAssist = (i: number, dir: -1 | 1) => {
    const arr = [...form.assists]
    const j = i + dir
    if (j < 0 || j >= arr.length) return
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    set('assists', arr)
  }

  const save = async () => {
    if (!form.slug || !form.name) {
      alert('slug 和 name 必填')
      return
    }
    setSaving(true)
    try {
      const url = isNew ? '/api/admin/templates' : `/api/admin/templates/${id}`
      const method = isNew ? 'POST' : 'PATCH'
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!r.ok) {
        const t = await r.text()
        throw new Error(t)
      }
      navigate('/admin')
    } catch (e: any) {
      alert('保存失败：' + e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="admin-wrap"><div className="admin-empty">加载中…</div></div>

  return (
    <div className="admin-wrap">
      <header className="admin-head">
        <div>
          <div className="admin-eyebrow">Admin</div>
          <h1 className="admin-title">{isNew ? '新建模板' : `编辑：${form.name || '...'}`}</h1>
        </div>
        <div className="admin-actions">
          <Link to="/admin" className="admin-link">← 返回列表</Link>
          <button className="admin-btn" disabled={saving} onClick={save}>
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </header>

      <div className="admin-form">
        <section className="admin-section">
          <h3 className="admin-section-title">基本信息</h3>
          <div className="admin-grid-2">
            <label className="admin-field">
              <span>Slug（唯一标识）</span>
              <input value={form.slug} onChange={e => set('slug', e.target.value)} placeholder="tpl-12" />
            </label>
            <label className="admin-field">
              <span>名称</span>
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="光影厅堂" />
            </label>
            <label className="admin-field">
              <span>英文风格</span>
              <input value={form.style_en} onChange={e => set('style_en', e.target.value)} placeholder="Quiet Light" />
            </label>
            <label className="admin-field">
              <span>分类</span>
              <select value={form.category} onChange={e => set('category', e.target.value)}>
                <option value="西式">西式</option>
                <option value="中式">中式</option>
                <option value="旅拍">旅拍</option>
                <option value="复古">复古</option>
              </select>
            </label>
            <label className="admin-field">
              <span>权重（数字大的在前）</span>
              <input type="number" value={form.weight} onChange={e => set('weight', Number(e.target.value))} />
            </label>
            <label className="admin-field">
              <span>状态</span>
              <label className="admin-switch admin-switch--inline">
                <input type="checkbox" checked={form.enabled} onChange={e => set('enabled', e.target.checked)} />
                <span />
                <em>{form.enabled ? '已上架' : '已下架'}</em>
              </label>
            </label>
          </div>
          <label className="admin-field">
            <span>简介</span>
            <textarea rows={2} value={form.description} onChange={e => set('description', e.target.value)} />
          </label>
        </section>

        <section className="admin-section">
          <h3 className="admin-section-title">封面图</h3>
          <div className="admin-cover-row">
            {form.cover_url
              ? <img src={form.cover_url} alt="cover" className="admin-cover-preview" />
              : <div className="admin-cover-preview admin-cover-preview--empty">未上传</div>}
            <label className="admin-btn admin-btn--ghost">
              {coverUploading ? '上传中…' : (form.cover_url ? '更换封面' : '上传封面')}
              <input type="file" accept="image/*" hidden disabled={coverUploading}
                onChange={e => e.target.files?.[0] && onCover(e.target.files[0])} />
            </label>
          </div>
        </section>

        <section className="admin-section">
          <h3 className="admin-section-title">参考图（assists，可多张）</h3>
          <div className="admin-assists">
            {form.assists.map((a, i) => (
              <div key={a.url + i} className="admin-assist">
                <img src={a.url} alt="" />
                <div className="admin-assist-ctrl">
                  <button onClick={() => moveAssist(i, -1)} disabled={i === 0}>↑</button>
                  <button onClick={() => moveAssist(i, 1)} disabled={i === form.assists.length - 1}>↓</button>
                  <button className="admin-danger" onClick={() => removeAssist(i)}>×</button>
                </div>
              </div>
            ))}
            <label className="admin-assist admin-assist--add">
              <span>{assistUploading ? '上传中…' : '+ 添加'}</span>
              <input type="file" accept="image/*" multiple hidden disabled={assistUploading}
                onChange={e => e.target.files && onAddAssists(e.target.files)} />
            </label>
          </div>
        </section>

        <section className="admin-section">
          <h3 className="admin-section-title">Prompt（长描述，将作为生成提示）</h3>
          <textarea
            className="admin-prompt"
            rows={16}
            value={form.prompt}
            onChange={e => set('prompt', e.target.value)}
            placeholder="场景：极简浅米色墙面..."
          />
          <div className="admin-prompt-meta">{form.prompt.length} 字</div>
        </section>
      </div>
    </div>
  )
}
