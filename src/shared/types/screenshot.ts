export type CaptureMode = 'visible' | 'fullpage' | 'region' | 'video'

export type AnnotationTool = 'pen' | 'text' | 'eraser' | 'crop'

export interface RegionRect {
  x: number
  y: number
  width: number
  height: number
}
