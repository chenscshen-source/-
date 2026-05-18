import { useRef } from 'react'

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

export default function FaceSlot({
  label, value, onChange, size = 132,
}: { label: string; value: string | null; onChange: (d: string | null) => void; size?: number }) {
  const ref = useRef<HTMLInputElement>(null)
  const onFile = async (f: File | undefined) => {
    if (!f) return
    onChange(await readFileAsDataURL(f))
  }
  return (
    <div className="face-slot">
      <div
        className="face-circle"
        style={{ width: size, height: size }}
        onClick={() => ref.current?.click()}
      >
        {value ? <img src={value} alt={label} /> : <span className="plus">+</span>}
        {value && <div className="replace">更换</div>}
        <input
          ref={ref} type="file" accept="image/*" hidden
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </div>
      <div className="face-label">{label}</div>
    </div>
  )
}
