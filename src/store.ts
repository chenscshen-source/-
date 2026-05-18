import { create } from 'zustand'
import type { Template } from './types'

export interface ResultGroup {
  template: Template
  images: string[]
}

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
    set({ selected: exists ? cur.filter(x => x.id !== t.id) : [...cur, t] })
  },
  clearTemplates: () => set({ selected: [] }),
  setGroomFace: (d) => set({ groomFace: d }),
  setBrideFace: (d) => set({ brideFace: d }),
  setResults: (r) => set({ results: r }),
  reset: () => set({ selected: [], groomFace: null, brideFace: null, results: [] }),
}))
