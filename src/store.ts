import { create } from 'zustand'
import type { Template } from './types'

export interface ResultGroup {
  template: Template
  images: string[]
}

/** 选择模板的硬上限，超过就不让加（避免 Vercel 60s 超时 & 用户等太久） */
export const MAX_TEMPLATES = 3

interface FlowState {
  selected: Template[]
  groomFace: string | null
  brideFace: string | null
  results: ResultGroup[]
  toggleTemplate: (t: Template) => void
  clearTemplates: () => void
  setGroomFace: (d: string | null) => void
  setBrideFace: (d: string | null) => void
  setResults: (r: ResultGroup[]) => void
  reset: () => void
}

export const useFlow = create<FlowState>((set, get) => ({
  selected: [],
  groomFace: null,
  brideFace: null,
  results: [],
  toggleTemplate: (t) => {
    const cur = get().selected
    const exists = cur.some(x => x.id === t.id)
    if (exists) {
      set({ selected: cur.filter(x => x.id !== t.id) })
    } else if (cur.length < MAX_TEMPLATES) {
      set({ selected: [...cur, t] })
    }
    // else 已经选满，忽略本次点击
  },
  clearTemplates: () => set({ selected: [] }),
  setGroomFace: (d) => set({ groomFace: d }),
  setBrideFace: (d) => set({ brideFace: d }),
  setResults: (r) => set({ results: r }),
  reset: () => set({ selected: [], groomFace: null, brideFace: null, results: [] }),
}))
