export interface Template {
  id: string
  name: string
  styleEn: string
  category: '中式' | '西式' | '旅拍' | '复古'
  cover: string
  description: string
  prompt: string
  sampleResults: string[]
  /** 辅助参考图（不在前端展示，仅在生成时随 prompt 一起送到 API） */
  assists?: string[]
}

export interface GenerationTask {
  taskId: string
  status: 'pending' | 'processing' | 'succeeded' | 'failed'
  progress: number
  images: string[]
  error?: string
}
