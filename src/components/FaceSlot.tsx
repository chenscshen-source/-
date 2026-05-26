import { useRef, useState } from 'react'

/**
 * 浏览器端轻压缩：提高到 1600 长边 + JPEG q90，优先保留面部细节，
 * 同时尽量避免触发 Vercel 4.5MB payload 上限。
 */
async function compressToDataURL(file: File, maxDim = 1600, quality = 0.9): Promise<string> {
  const objURL = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = reject
      i.src = objURL
    })
    let { width, height } = img
    const long = Math.max(width, height)
    if (long > maxDim) {
      const ratio = maxDim / long
      width = Math.round(width * ratio)
      height = Math.round(height * ratio)
    }
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, width, height)
    return canvas.toDataURL('image/jpeg', quality)
  } finally {
    URL.revokeObjectURL(objURL)
  }
}

export default function FaceSlot({
  label, value, onChange, size = 132,
}: { label: string; value: string | null; onChange: (d: string | null) => void; size?: number }) {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const onFile = async (f: File | undefined) => {
    if (!f) return
    setBusy(true)
    try {
      const dataUrl = await compressToDataURL(f)
      console.log('[FaceSlot] compressed face: orig=%s KB → %s KB',
        Math.round(f.size / 1024),
        Math.round(dataUrl.length / 1024))
      onChange(dataUrl)
    } catch (e) {
      console.error('[FaceSlot] compress failed, fallback to original', e)
      // 兜底：FileReader 直读 base64
      const r = new FileReader()
      r.onload = () => onChange(r.result as string)
      r.readAsDataURL(f)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="face-slot">
      <div
        className="face-circle"
        style={{ width: size, height: size }}
        onClick={() => ref.current?.click()}
      >
        {value ? <img src={value} alt={label} /> : <span className="plus">+</span>}
        {value && !busy && (
          <button
            type="button"
            className="face-remove"
            aria-label={`删除${label}头像`}
            onClick={(e) => {
              e.stopPropagation()
              onChange(null)
            }}
          >
            ×
          </button>
        )}
        {value && <div className="replace">更换</div>}
        {busy && <div className="replace" style={{ opacity: 1 }}>处理中…</div>}
        <input
          ref={ref} type="file" accept="image/*" hidden
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </div>
      <div className="face-label">{label}</div>
    </div>
  )
}
