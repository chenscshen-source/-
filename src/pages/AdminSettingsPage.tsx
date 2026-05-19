import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

interface Settings {
  prefix_enabled: boolean
  scene_block: string
  face_block: string
  priority_block: string
}

const EMPTY: Settings = {
  prefix_enabled: true,
  scene_block: '',
  face_block: '',
  priority_block: '',
}

export default function AdminSettingsPage() {
  const [form, setForm] = useState<Settings>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/settings')
      .then(r => r.json())
      .then(j => setForm(j.settings))
      .catch(e => alert('加载失败：' + e.message))
      .finally(() => setLoading(false))
  }, [])

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    setSaving(true)
    setMsg(null)
    try {
      const r = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!r.ok) throw new Error(await r.text())
      const j = await r.json()
      setForm(j.settings)
      setMsg('已保存')
      setTimeout(() => setMsg(null), 2000)
    } catch (e: any) {
      alert('保存失败：' + e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="admin-wrap"><div className="admin-empty">加载中…</div></div>

  // 预览：把占位符替换成 3 张 assists + 双脸的示例
  const preview = !form.prefix_enabled
    ? '（已关闭，前端会原样使用模板 prompt，不加任何前缀）'
    : '【参考图角色说明】\n' +
      form.scene_block.replaceAll('{ASSIST_RANGE}', '第1~3张') + '\n' +
      form.face_block.replaceAll('{FACE_PARTS}', '第4张为新郎本人面部参考；第5张为新娘本人面部参考') + '\n' +
      form.priority_block + '\n'

  return (
    <div className="admin-wrap">
      <header className="admin-head">
        <div>
          <div className="admin-eyebrow">Admin · Settings</div>
          <h1 className="admin-title">Prompt 前缀设置</h1>
        </div>
        <div className="admin-actions">
          <Link to="/admin" className="admin-link">← 返回列表</Link>
          <button className="admin-btn" disabled={saving} onClick={save}>
            {saving ? '保存中…' : '保存'}
          </button>
          {msg && <span style={{ color: 'var(--gold-deep)', fontSize: 13 }}>{msg}</span>}
        </div>
      </header>

      <div className="admin-form">
        <section className="admin-section">
          <h3 className="admin-section-title">总开关</h3>
          <label className="admin-switch admin-switch--inline">
            <input type="checkbox" checked={form.prefix_enabled}
              onChange={e => set('prefix_enabled', e.target.checked)} />
            <span />
            <em>{form.prefix_enabled ? '已启用：自动在每个 prompt 前加身份/场景指令' : '已关闭：直接使用模板原始 prompt'}</em>
          </label>
        </section>

        <section className="admin-section">
          <h3 className="admin-section-title">场景视觉参考块</h3>
          <p className="admin-hint">
            仅当模板含有 assists 时生效。可使用占位符 <code>{'{ASSIST_RANGE}'}</code>，会被替换成"第1~3张"等。
          </p>
          <textarea className="admin-prompt" rows={6}
            value={form.scene_block}
            onChange={e => set('scene_block', e.target.value)} />
        </section>

        <section className="admin-section">
          <h3 className="admin-section-title">人脸锁定块</h3>
          <p className="admin-hint">
            只要有上传新郎或新娘脸图就生效。可使用占位符 <code>{'{FACE_PARTS}'}</code>，会被替换成"第N张为新郎/新娘本人面部参考"。
          </p>
          <textarea className="admin-prompt" rows={6}
            value={form.face_block}
            onChange={e => set('face_block', e.target.value)} />
        </section>

        <section className="admin-section">
          <h3 className="admin-section-title">优先级块</h3>
          <p className="admin-hint">
            仅当模板含有 assists 时生效，告诉模型在场景和人脸冲突时怎么取舍。
          </p>
          <textarea className="admin-prompt" rows={3}
            value={form.priority_block}
            onChange={e => set('priority_block', e.target.value)} />
        </section>

        <section className="admin-section">
          <h3 className="admin-section-title">实时预览（按 3 张 assists + 双脸示例渲染）</h3>
          <pre className="admin-preview">{preview}</pre>
        </section>
      </div>
    </div>
  )
}
