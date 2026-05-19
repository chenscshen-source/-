import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import TemplatesPage from './pages/TemplatesPage'
import ResultPage from './pages/ResultPage'
import AdminListPage from './pages/AdminListPage'
import AdminEditPage from './pages/AdminEditPage'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/templates" replace />} />
        <Route path="/templates" element={<TemplatesPage />} />
        <Route path="/upload/:templateId" element={<Navigate to="/templates" replace />} />
        <Route path="/result" element={<ResultPage />} />
        <Route path="/admin" element={<AdminListPage />} />
        <Route path="/admin/templates/new" element={<AdminEditPage />} />
        <Route path="/admin/templates/:id" element={<AdminEditPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
