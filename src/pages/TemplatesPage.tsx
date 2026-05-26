import { useEffect, useState } from 'react'
import TopBar from '../components/TopBar'
import UploadPanel from '../components/UploadPanel'
import { categories } from '../data/templates'
import { fetchTemplates } from '../services/templatesApi'
import { inferTemplateMode, type PeopleMode } from '../services/templateMode'
import { useFlow, MAX_TEMPLATES } from '../store'
import type { Template } from '../types'

export default function TemplatesPage() {
  const [filter, setFilter] = useState<(typeof categories)[number]>('全部')
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteChecked, setInviteChecked] = useState(false)
  const [inviteRequired, setInviteRequired] = useState(true)
  const [inviteVerified, setInviteVerified] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [modeMap, setModeMap] = useState<Record<string, PeopleMode>>({})
  const { selected, toggleTemplate } = useFlow()
  const isSelected = (id: string) => selected.some(t => t.id === id)
  const atLimit = selected.length >= MAX_TEMPLATES

  useEffect(() => {
    fetch('/api/invite/status')
      .then(r => r.json())
      .then(j => {
        setInviteRequired(!!j.required)
        setInviteVerified(!!j.verified)
        setInviteChecked(true)
        if (!j.required || j.verified) {
          return fetchTemplates().then(async t => {
            setTemplates(t)
            setLoading(false)
            const pairs = await Promise.all(t.map(async (tpl) => [tpl.id, await inferTemplateMode(tpl)] as const))
            setModeMap(Object.fromEntries(pairs))
          })
        }
        setLoading(false)
      })
      .catch(e => { console.error('[invite status]', e); setInviteChecked(true); setLoading(false) })
  }, [])

  const submitInvite = async () => {
    if (!inviteCode.trim()) return
    setInviteBusy(true)
    setInviteError('')
    try {
      const r = await fetch('/api/invite/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: inviteCode.trim() }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      const t = await fetchTemplates(true)
      setTemplates(t)
      const pairs = await Promise.all(t.map(async (tpl) => [tpl.id, await inferTemplateMode(tpl)] as const))
      setModeMap(Object.fromEntries(pairs))
      setInviteVerified(true)
    } catch (e: any) {
      setInviteError(String(e?.message ?? e))
    } finally {
      setInviteBusy(false)
    }
  }

  const list = filter === '全部' ? templates : templates.filter(t => t.category === filter)

  const pick = (t: Template) => {
    const nextMode = modeMap[t.id] ?? 'unknown'
    const selectedModes = selected
      .map(item => modeMap[item.id] ?? 'unknown')
      .filter((m): m is Exclude<PeopleMode, 'unknown'> => m !== 'unknown')
    const currentMode = selectedModes[0]
    if (currentMode && nextMode !== 'unknown' && currentMode !== nextMode && !isSelected(t.id)) {
      alert(`当前已选择${currentMode === 'single' ? '单人' : '双人'}模板，不能混选${nextMode === 'single' ? '单人' : '双人'}模板`)
      return
    }
    // 已选满且这张不是已选的 → 提示一下
    if (atLimit && !isSelected(t.id)) {
      alert(`最多选 ${MAX_TEMPLATES} 个模板`)
      return
    }
    toggleTemplate(t)
  }

  const blocked = inviteChecked && inviteRequired && !inviteVerified

  return (
    <>
      <TopBar />
      <section className="hero hero--full">
        <div className="hero-media">
          <img
            src="https://images.unsplash.com/photo-1731576089080-8c1eda0a3536?w=2400&q=85&auto=format&fit=crop"
            alt="hero"
          />
          <div className="hero-veil" />
        </div>
        <div className="hero-content">
          <div className="hero-date">— 写&nbsp;给&nbsp;此&nbsp;生&nbsp;一&nbsp;次&nbsp;的&nbsp;郑&nbsp;重 —</div>
          <h1 className="hero-title">
            <span className="hero-zh">囍 念</span>
            <span className="hero-script script">Forever &amp; Always</span>
          </h1>
          <div className="hero-sub">AI · Bridal Portrait Studio</div>
          <a href="#templates" className="hero-cta" aria-label="开始挑选">
            <span>开 始 挑 选</span>
            <span className="hero-cta-arrow">↓</span>
          </a>
        </div>

        {/* Floating filter toolbar — half overlapping hero bottom */}
        <div className="hero-toolbar" id="templates">
          <div className="hero-toolbar-inner">
            <div className="hero-toolbar-eyebrow">
              <span className="step-num">01</span>
              <span className="step-text">选择心仪模板</span>
              <span className="step-divider" />
              <span className="step-en">Choose Templates</span>
            </div>
            <div className="tpl-toolbar tpl-toolbar--floating">
              {categories.map(c => (
                <button
                  key={c}
                  className={`chip ${filter === c ? 'active' : ''}`}
                  onClick={() => setFilter(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="layout">
        <main className="layout-main">
          {loading && (
            <div style={{ padding: 80, textAlign: 'center', color: 'var(--ink-soft)' }}>
              正在加载模板…
            </div>
          )}
          <div className="tpl-grid">
            {list.map(t => {
              const on = isSelected(t.id)
              return (
                <div
                  key={t.id}
                  className={`tpl-card ${on ? 'selected' : ''} ${atLimit && !on ? 'disabled' : ''}`}
                  onClick={() => pick(t)}
                >
                  <div className="badge">{t.category}</div>
                  <div className={`check ${on ? 'on' : ''}`}>{on ? '✓' : ''}</div>
                  <div className="cover">
                    <img src={t.cover} alt={t.name} loading="lazy" />
                    <div className={`pick ${on ? 'selected-tag' : ''}`}>
                      {on ? '已 选 中 · 点 击 取 消' : '加 入 选 择'}
                    </div>
                  </div>
                  <div className="meta">
                    <h3 className="name">{t.name}</h3>
                    <div className="style">{t.styleEn}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </main>

        <UploadPanel />
      </div>
      {blocked && (
        <div className="invite-overlay">
          <div className="invite-modal">
            <h3>请输入邀请码</h3>
            <p>当前为测试阶段，仅限受邀用户使用。</p>
            <input
              value={inviteCode}
              onChange={e => setInviteCode(e.target.value)}
              placeholder="输入邀请码"
              onKeyDown={e => { if (e.key === 'Enter') submitInvite() }}
            />
            {inviteError && <div className="invite-error">{inviteError}</div>}
            <button className="admin-btn" disabled={inviteBusy || !inviteCode.trim()} onClick={submitInvite}>
              {inviteBusy ? '验证中…' : '进入'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
