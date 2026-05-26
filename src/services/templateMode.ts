import type { Template } from '../types'

export type PeopleMode = 'single' | 'couple' | 'unknown'

function inferByText(t: Template): PeopleMode {
  const text = `${t.name} ${t.description} ${t.prompt}`.toLowerCase()
  const hasCouple =
    /双人|两人|情侣|夫妻|合照|couple|wedding couple|bride and groom/.test(text) ||
    (text.includes('新郎') && text.includes('新娘'))
  if (hasCouple) return 'couple'
  if (/单人|solo|single portrait|新娘单人|新郎单人|单人照/.test(text)) return 'single'
  return 'unknown'
}

async function inferByCover(coverUrl: string): Promise<PeopleMode> {
  const FaceDetectorCtor = (window as any).FaceDetector
  if (!FaceDetectorCtor) return 'unknown'
  try {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('image load failed'))
      img.src = coverUrl
    })
    const detector = new FaceDetectorCtor({ maxDetectedFaces: 3, fastMode: true })
    const faces = await detector.detect(img)
    if (faces.length >= 2) return 'couple'
    if (faces.length === 1) return 'single'
    return 'unknown'
  } catch {
    return 'unknown'
  }
}

export async function inferTemplateMode(t: Template): Promise<PeopleMode> {
  const byText = inferByText(t)
  if (byText !== 'unknown') return byText
  return inferByCover(t.cover)
}

