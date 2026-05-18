import { useState } from 'react'
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

export default function UploadPanel() {
  const {
    selected, groomFace, brideFace,
    setGroomFace, setBrideFace, setResults, toggleTemplate, clearTemplates,
  } = useFlow()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<BatchProgress | null>(null)

  const hasTpl = selected.length > 0
  const ready = hasTpl && !!groomFace && !!brideFace

  const onGenerate = async () => {
    if (!ready) return
    setLoading(true)
    try {
      const results = await generateBatch(
        selected, groomFace!, brideFace!,
        (p) => setProgress(p),
      )
      setResults(results)
      navigate('/result')
    } catch (e: any) {
      console.error(e)
      setLoading(false)
      const msg = String(e?.message ?? e)
      // 额度不足这种业务错原样透出
      if (/quota|余额|额度/i.test(msg)) alert('生成失败：' + msg)
      else alert('生成失败：' + msg.slice(0, 240))
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
        <FaceSlot label="新郎" value={groomFace} onChange={setGroomFace} />
        <FaceSlot label="新娘" value={brideFace} onChange={setBrideFace} />
      </div>

      <button className="btn-primary" disabled={!ready} onClick={onGenerate}>
        生 成 {hasTpl ? `${selected.length} 组` : ''}成 片
      </button>
      <p className="side-hint">
        {!hasTpl ? '挑选至少一个模板' :
          !groomFace || !brideFace ? '上传两张正脸照即可生成' :
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
