import { Link, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'

export default function TopBar() {
  const { pathname } = useLocation()
  const heroPage = pathname === '/' || pathname === '/templates'
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    if (!heroPage) { setScrolled(true); return }
    const on = () => setScrolled(window.scrollY > 60)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [heroPage])

  const over = heroPage && !scrolled

  return (
    <header className={`topbar ${over ? 'topbar--over' : 'topbar--solid'}`}>
      <Link to="/templates" className="logo">
        <img className="logo-mark" src="/logo.png" alt="囍念" />
        <span className="zh">囍念</span>
        <span className="en">Hitched · AI</span>
      </Link>
      <nav className="nav">
        <a href="#">教程</a>
        <a href="#">用户中心</a>
        <div className="avatar">R</div>
      </nav>
    </header>
  )
}
