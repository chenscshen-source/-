import { Link, useNavigate, Navigate } from 'react-router-dom'
import TopBar from '../components/TopBar'
import { useFlow } from '../store'
import { generateBatch } from '../services/generation'
import { useState } from 'react'

export default function ResultPage() {
  const { selected, groomFace, brideFace, results, setResults } = useFlow()
  const [regen, setRegen] = useState(false)
  const navigate = useNavigate()

  if (results.length === 0) {
    return <Navigate to="/templates" replace />
  }

  const download = (url: string, name: string) => {
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.target = '_blank'
    a.rel = 'noopener'
    a.click()
  }

  const regenerate = async () => {
    if (!groomFace || !brideFace || selected.length === 0) return
    setRegen(true)
    const r = await generateBatch(selected, groomFace, brideFace)
    setResults(r)
    setRegen(false)
  }

  return (
    <>
      <TopBar />
      <div className="result-head">
        <div className="eyebrow" style={{ fontSize: 12, letterSpacing: '0.45em', color: 'var(--gold-deep)', textTransform: 'uppercase', marginBottom: 14 }}>
          Step 03 · Your Memory
        </div>
        <div className="couple">
          {groomFace && <div className="face"><img src={groomFace} alt="新郎" /></div>}
          <span className="heart">❤</span>
          {brideFace && <div className="face"><img src={brideFace} alt="新娘" /></div>}
        </div>
        <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 40, fontWeight: 500, margin: '4px 0 8px', letterSpacing: '0.04em' }}>
          这 一 帧，已 经 属 于 你 们
        </h1>
        <div className="divider" />
        <p style={{ color: 'var(--ink-soft)', fontSize: 14, margin: 0 }}>
          共 {results.length} 个模板 · {results.reduce((n, g) => n + g.images.length, 0)} 张成片
        </p>
      </div>

      <div className="container">
        {results.map((group) => (
          <section key={group.template.id} className="result-section">
            <div className="result-section-head">
              <div>
                <h2>{group.template.name}</h2>
                <span className="style">{group.template.styleEn}</span>
              </div>
              <Link to="/templates" className="btn-ghost">换 一 帧</Link>
            </div>
            <div className="result-grid">
              {group.images.map((src, i) => (
                <div key={i} className="result-card">
                  <img src={src} alt={`${group.template.name}-${i}`} />
                  <div className="actions">
                    <button onClick={() => download(src, `${group.template.id}-${i + 1}.jpg`)}>
                      下 载<span className="glyph">↓</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        <div className="result-footer">
          <button className="btn-ghost" onClick={() => navigate('/templates')}>重 新 挑 选</button>
          <button className="btn-ghost" onClick={regenerate} disabled={regen}>
            {regen ? '生成中…' : '全 部 重 新 生 成'}
          </button>
        </div>
      </div>
    </>
  )
}
