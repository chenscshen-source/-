import { useState } from 'react'
import TopBar from '../components/TopBar'
import UploadPanel from '../components/UploadPanel'
import { templates, categories } from '../data/templates'
import { useFlow } from '../store'
import type { Template } from '../types'

export default function TemplatesPage() {
  const [filter, setFilter] = useState<(typeof categories)[number]>('全部')
  const { selected, toggleTemplate } = useFlow()
  const isSelected = (id: string) => selected.some(t => t.id === id)

  const list = filter === '全部' ? templates : templates.filter(t => t.category === filter)

  const pick = (t: Template) => toggleTemplate(t)

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
          <div className="tpl-grid">
            {list.map(t => {
              const on = isSelected(t.id)
              return (
                <div
                  key={t.id}
                  className={`tpl-card ${on ? 'selected' : ''}`}
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
    </>
  )
}
