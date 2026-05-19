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

export default function AdminListPage() {
  const [rows, setRows] = useState<AdminRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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

  return (
    <div className="admin-wrap">
      <header className="admin-head">
        <div>
          <div className="admin-eyebrow">Admin</div>
          <h1 className="admin-title">模板管理</h1>
        </div>
        <div className="admin-actions">
          <Link to="/templates" className="admin-link">← 返回前台</Link>
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
