import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useFlow, MAX_TEMPLATES } from '../store'
import { generateBatch, estimateTotalSeconds, type BatchProgress } from '../services/generation'

/** 把秒数格式化成"约 X 分 Y 秒"；为减少跳动，5 秒一档对齐 */
function formatEta(s: number): string {
  if (s <= 0) return '即将完成'
  const t = Math.max(5, Math.round(s / 5) * 5)
  const m = Math.floor(t / 60)
  const sec = t % 60
  if (m === 0) return `${sec} 秒`
  if (sec === 0) return `${m} 分钟`
  return `${m} 分 ${sec} 秒`
}

/** 用于按钮下方的"约 N 分钟"提示；按整分钟向上取整，避免显示"约 0 分钟" */
function formatTotalEstimate(s: number): string {
  if (s <= 0) return ''
  if (s < 60) return `${s} 秒`
  const m = Math.ceil(s / 60)
  return `${m} 分钟`
}
import FaceSlot from './FaceSlot'

type PeopleMode = 'single' | 'couple' | 'unknown'
function inferPeopleModeByText(text: string): PeopleMode {
  const t = text.toLowerCase()
  const hasCouple =
    /双人|两人|情侣|夫妻|合照|couple|wedding couple|bride and groom/.test(t) ||
    (t.includes('新郎') && t.includes('新娘'))
  if (hasCouple) return 'couple'
  if (/单人|solo|single portrait|新娘单人|新郎单人|单人照/.test(t)) return 'single'
  return 'unknown'
}

export default function UploadPanel() {
  const {
    selected, groomFace, brideFace,
    setGroomFace, setBrideFace, setResults, toggleTemplate, clearTemplates,
  } = useFlow()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<BatchProgress | null>(null)

  const hasTpl = selected.length > 0
  const selectedMode = selected
    .map(t => inferPeopleModeByText(`${t.name} ${t.description} ${t.prompt}`))
    .find(m => m !== 'unknown') ?? 'unknown'
  const hasAnyFace = !!groomFace || !!brideFace
  const ready = hasTpl && hasAnyFace

  useEffect(() => {
    if (selectedMode === 'single' && groomFace && brideFace) {
      setBrideFace(null)
      alert('当前为单人模板，仅保留一张人像。')
    }
  }, [selectedMode])

  const onSetGroom = (d: string | null) => {
    if (d && selectedMode === 'single' && brideFace) {
      alert('当前选择的是单人模板，只能上传一张人像。')
      return
    }
    setGroomFace(d)
  }
  const onSetBride = (d: string | null) => {
    if (d && selectedMode === 'single' && groomFace) {
      alert('当前选择的是单人模板，只能上传一张人像。')
      return
    }
    setBrideFace(d)
  }

  const onGenerate = async () => {
    if (!ready) return
    setLoading(true)
    try {
      while (true) {
        try {
          const results = await generateBatch(
            selected, groomFace ?? '', brideFace ?? '',
            (p) => setProgress(p),
          )
          setResults(results)
          navigate('/result')
          return
        } catch (e: any) {
          const msg = String(e?.message ?? e)
          if (/INVITE_EXHAUSTED|邀请码次数已用完/i.test(msg)) {
            alert('当前邀请码次数已用完，请输入新邀请码后继续。')
            window.location.href = '/templates'
            return
          }
          if (!/INVITE_REQUIRED/i.test(msg)) throw e
          const code = window.prompt('请输入邀请码后继续生成：')?.trim()
          if (!code) {
            alert('未输入邀请码，已取消生成。')
            return
          }
          const verify = await fetch('/api/invite/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
          })
          const j = await verify.json().catch(() => ({}))
          if (!verify.ok) {
            alert(j.error || '邀请码无效，请重试')
            continue
          }
          // 验证成功后继续 while，自动重试生成
        }
      }
    } catch (e: any) {
      console.error(e)
      const msg = String(e?.message ?? e)
      // 额度不足这种业务错原样透出
      if (/quota|余额|额度/i.test(msg)) alert('生成失败：' + msg)
      else alert('生成失败：' + msg.slice(0, 240))
    } finally {
      setLoading(false)
      setProgress(null)
    }
  }

  return (
    <aside className="side-panel">
      <div className="side-eyebrow">Step 02 · Your Faces</div>
      <h3 className="side-title">面 容 入 镜</h3>

      <div className="selected-list">
        <div className="selected-head">
          <span>已选模板</span>
          <span className="selected-count">{selected.length} / {MAX_TEMPLATES}</span>
          {hasTpl && (
            <button className="clear-btn" onClick={clearTemplates}>清空</button>
          )}
        </div>
        <div className="selected-thumbs">
          {hasTpl
            ? selected.map(t => (
                <div key={t.id} className="thumb" title={t.name}>
                  <img src={t.cover} alt={t.name} />
                  <button
                    className="thumb-remove"
                    onClick={() => toggleTemplate(t)}
                    aria-label="移除"
                  >×</button>
                  <div className="thumb-name">{t.name}</div>
                </div>
              ))
            : <div className="thumb thumb-empty thumb-empty--wide" aria-hidden />}
        </div>
      </div>

      <div className="face-row">
        <FaceSlot label="新郎" value={groomFace} onChange={onSetGroom} />
        <FaceSlot label="新娘" value={brideFace} onChange={onSetBride} />
      </div>

      <button className="btn-primary" disabled={!ready} onClick={onGenerate}>
        生 成 {hasTpl ? `${selected.length} 组` : ''}成 片
      </button>
      <p className="side-hint">
        {!hasTpl ? '挑选至少一个模板' :
          !hasAnyFace ? (selectedMode === 'single' ? '单人模板：上传一张人像即可生成' : '上传至少一张人像即可生成') :
          selectedMode === 'single' ? '单人模板：仅允许一张人像' :
          `预计 ${formatTotalEstimate(estimateTotalSeconds(selected.length))}，每个模板出 2 张`}
      </p>

      {loading && progress && createPortal(
        <div className="loading-overlay" role="status" aria-live="polite">
          <div className="loading-bg" aria-hidden />
          <div className="loading-orbit" aria-hidden>
            <span /><span /><span />
          </div>

          <div className="loading-stage">
            <div className="loading-brand">
              <img src="/logo.png" alt="" className="loading-logo" />
              <div className="loading-wordmark">
                <span className="zh">囍 念</span>
                <span className="en">Hitched · AI</span>
              </div>
            </div>

            <div className="loading-eyebrow">A I · B R I D A L · I N · P R O G R E S S</div>

            <h2 className="loading-title">
              正 在 为 你 们 写 下&nbsp;
              <span className="hl">「{progress.templateName || '这 一 帧'}」</span>
            </h2>

            <div className="loading-stagename">{progress.stage}…</div>

            <div className="loading-progress">
              <div className="loading-progress-track">
                <div className="loading-progress-fill" style={{ width: `${progress.percent}%` }} />
              </div>
              <div className="loading-progress-meta">
                <span className="meta-num">
                  <span className="meta-label">模板</span>
                  <span className="big">{String(progress.current).padStart(2, '0')}</span>
                  <span className="sep">/</span>
                  <span className="total">{String(progress.total).padStart(2, '0')}</span>
                </span>
                <span className="meta-eta">
                  预计还需&nbsp;<span className="eta-num">{formatEta(progress.etaSeconds)}</span>
                </span>
                <span className="meta-pct">{progress.percent}%</span>
              </div>
            </div>

            {selected.length > 0 && (
              <div className="loading-strip">
                {selected.map((t, i) => {
                  const done = i + 1 < progress.current
                  const active = i + 1 === progress.current
                  return (
                    <div
                      key={t.id}
                      className={`loading-strip-item ${done ? 'done' : ''} ${active ? 'active' : ''}`}
                      title={t.name}
                    >
                      <img src={t.cover} alt={t.name} />
                      <div className="loading-strip-veil" />
                      <div className="loading-strip-label">{t.name}</div>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="loading-hint">请稍候，AI 正在精修中。关闭窗口将中断生成。</div>
          </div>
        </div>,
        document.body,
      )}
    </aside>
  )
}
