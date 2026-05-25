import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

interface InviteRow {
  id: string
  code: string
  note: string | null
  max_uses: number
  used_count: number
  expires_at: string | null
  enabled: boolean
}

export default function AdminInvitesPage() {
  const [rows, setRows] = useState<InviteRow[]>([])
  const [required, setRequired] = useState(true)
  const [loading, setLoading] = useState(true)
  const makeCode = () => {
    const t = Date.now().toString(36).toUpperCase().slice(-4)
    const r = Math.random().toString(36).slice(2, 8).toUpperCase()
    return `INV-${t}${r}`
  }
  const [code, setCode] = useState(makeCode())
  const [maxUses, setMaxUses] = useState(20)
  const [expiresAt, setExpiresAt] = useState('')
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [creating, setCreating] = useState(false)

  const load = async () => {
    setLoading(true)
    setErr('')
    try {
      const r = await fetch('/api/admin/invites')
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      setRows(j.invites ?? [])
      setRequired(!!j.required)
    } catch (e: any) {
      setErr(`加载失败：${String(e?.message ?? e)}。请先访问 /api/admin/init 初始化数据库后重试。`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const createOne = async () => {
    if (!code.trim() || creating) return
    setCreating(true)
    setMsg('')
    setErr('')
    try {
      const r = await fetch('/api/admin/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim(),
          max_uses: maxUses,
          expires_at: expiresAt || null,
          note: note || null,
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        const message = j?.error || `HTTP ${r.status}`
        setErr(`创建失败：${message}`)
        alert(`创建失败：${message}`)
        return
      }
      setCode('')
      setCode(makeCode())
      setNote('')
      setExpiresAt('')
      setMaxUses(20)
      setMsg('邀请码已创建')
      await load()
    } finally {
      setCreating(false)
    }
  }

  const toggleRequired = async (next: boolean) => {
    setRequired(next)
    setMsg('')
    setErr('')
    await fetch('/api/admin/invites', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ required: next }),
    })
    setMsg(next ? '已开启邀请码模式' : '已关闭邀请码模式')
  }

  const toggleEnabled = async (row: InviteRow) => {
    await fetch(`/api/admin/invites/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !row.enabled }),
    })
    await load()
  }

  const removeOne = async (row: InviteRow) => {
    if (!confirm(`删除邀请码 ${row.code} ?`)) return
    await fetch(`/api/admin/invites/${row.id}`, { method: 'DELETE' })
    await load()
  }

  const copyCode = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setMsg(`已复制：${text}`)
      setTimeout(() => setMsg(''), 1500)
    } catch {
      setErr('复制失败，请手动复制')
    }
  }

  return (
    <div className="admin-wrap">
      <header className="admin-head">
        <div>
          <div className="admin-eyebrow">Admin</div>
          <h1 className="admin-title">邀请码管理</h1>
        </div>
        <div className="admin-actions">
          <Link to="/admin" className="admin-link">← 返回列表</Link>
        </div>
      </header>
      {!!msg && <div className="admin-empty" style={{ padding: '12px 16px', marginBottom: 12 }}>{msg}</div>}
      {!!err && <div className="admin-empty admin-empty--err" style={{ padding: '12px 16px', marginBottom: 12 }}>{err}</div>}

      <section className="admin-section">
        <h3 className="admin-section-title">测试入口控制</h3>
        <label className="admin-switch admin-switch--inline">
          <input type="checkbox" checked={required} onChange={e => toggleRequired(e.target.checked)} />
          <span />
          <em>{required ? '已开启邀请码模式' : '已关闭邀请码模式'}</em>
        </label>
      </section>

      <section className="admin-section">
        <h3 className="admin-section-title">创建邀请码</h3>
        <div className="admin-grid-2">
          <label className="admin-field">
            <span>邀请码</span>
            <div className="admin-inline-input">
              <input value={code} readOnly placeholder="随机邀请码" />
              <button type="button" className="admin-btn admin-btn--ghost" onClick={() => setCode(makeCode())}>
                换一个
              </button>
            </div>
          </label>
          <label className="admin-field">
            <span>可用次数</span>
            <input type="number" min={1} value={maxUses} onChange={e => setMaxUses(Number(e.target.value || 1))} />
          </label>
          <label className="admin-field">
            <span>到期时间（可空）</span>
            <input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
          </label>
          <label className="admin-field">
            <span>备注（可空）</span>
            <input value={note} onChange={e => setNote(e.target.value)} />
          </label>
        </div>
        <button className="admin-btn" disabled={creating || !code.trim()} onClick={createOne}>
          {creating ? '创建中…' : '创建'}
        </button>
        {!!err && <div className="admin-hint" style={{ marginTop: 10, color: '#b54040' }}>{err}</div>}
        {!!msg && <div className="admin-hint" style={{ marginTop: 10, color: 'var(--gold-deep)' }}>{msg}</div>}
      </section>

      <section className="admin-section">
        <h3 className="admin-section-title">邀请码列表</h3>
        {loading ? <div className="admin-empty">加载中…</div> : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>邀请码</th><th>次数</th><th>到期</th><th>状态</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className={row.enabled ? '' : 'admin-row--off'}>
                  <td>
                    <div className="admin-code-row">
                      <div className="admin-name">{row.code}</div>
                      <button
                        type="button"
                        className="admin-copy-btn"
                        title="复制邀请码"
                        aria-label="复制邀请码"
                        onClick={() => copyCode(row.code)}
                      >
                        ⧉
                      </button>
                    </div>
                    <div className="admin-sub">{row.note || ''}</div>
                  </td>
                  <td>{row.used_count} / {row.max_uses}</td>
                  <td>{row.expires_at ? new Date(row.expires_at).toLocaleString() : '长期有效'}</td>
                  <td>
                    <label className="admin-switch">
                      <input type="checkbox" checked={row.enabled} onChange={() => toggleEnabled(row)} />
                      <span />
                    </label>
                  </td>
                  <td className="admin-row-actions">
                    <button className="admin-danger" onClick={() => removeOne(row)}>删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
