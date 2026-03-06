import { create } from 'zustand'
import type { CaptureMode, AnnotationTool } from '@shared/types'

interface CanvasHistoryEntry {
  dataUrl: string
}

// ── Module-level video recording state (not serializable → outside Zustand) ──
let _mediaRecorder: MediaRecorder | null = null
let _mediaStream: MediaStream | null = null
let _recordedChunks: Blob[] = []

interface ScreenshotStore {
  // — Capture state —
  isToolOpen: boolean
  isEditorOpen: boolean
  captureMode: CaptureMode
  timerSeconds: number // 0 | 3 | 5 | 10
  isCapturing: boolean
  isTimerRunning: boolean
  timerCountdown: number
  isRegionSelecting: boolean
  regionImageDataUrl: string | null

  // — Editor state —
  imageDataUrl: string | null
  activeTool: AnnotationTool
  penColor: string
  penSize: number
  fontSize: number
  textColor: string
  eraserSize: number

  // — Undo stack —
  undoStack: CanvasHistoryEntry[]
  undoIndex: number

  // — Video —
  isRecording: boolean
  recordingStartTime: number | null
  isSavingVideo: boolean

  // — Actions —
  openTool: () => void
  closeTool: () => void
  openEditor: (dataUrl: string) => void
  closeEditor: () => void
  setCaptureMode: (mode: CaptureMode) => void
  setTimerSeconds: (s: number) => void
  setIsCapturing: (v: boolean) => void
  setIsTimerRunning: (v: boolean) => void
  setTimerCountdown: (v: number) => void
  setIsRegionSelecting: (v: boolean, imageDataUrl?: string | null) => void
  setActiveTool: (tool: AnnotationTool) => void
  setPenColor: (color: string) => void
  setPenSize: (size: number) => void
  setFontSize: (size: number) => void
  setTextColor: (color: string) => void
  setEraserSize: (size: number) => void

  // Undo/redo
  pushUndoState: (entry: CanvasHistoryEntry) => void
  undo: () => CanvasHistoryEntry | null
  redo: () => CanvasHistoryEntry | null
  canUndo: () => boolean
  canRedo: () => boolean
  clearUndoStack: () => void

  // Video
  setIsRecording: (v: boolean) => void
  setRecordingStartTime: (t: number | null) => void
  startRecording: (tabId: string) => Promise<void>
  stopRecording: () => Promise<void>
}

export const useScreenshotStore = create<ScreenshotStore>((set, get) => ({
  // Defaults
  isToolOpen: false,
  isEditorOpen: false,
  captureMode: 'visible',
  timerSeconds: 0,
  isCapturing: false,
  isTimerRunning: false,
  timerCountdown: 0,
  isRegionSelecting: false,
  regionImageDataUrl: null,

  imageDataUrl: null,
  activeTool: 'pen',
  penColor: '#ff0000',
  penSize: 3,
  fontSize: 16,
  textColor: '#ff0000',
  eraserSize: 20,

  undoStack: [],
  undoIndex: -1,

  isRecording: false,
  recordingStartTime: null,
  isSavingVideo: false,

  // Actions
  openTool: () => set({ isToolOpen: true }),
  closeTool: () =>
    set({
      isToolOpen: false,
      isCapturing: false,
      isTimerRunning: false,
      timerCountdown: 0,
      isRegionSelecting: false,
      regionImageDataUrl: null
    }),

  openEditor: (dataUrl) =>
    set({
      isEditorOpen: true,
      isToolOpen: false,
      imageDataUrl: dataUrl,
      isCapturing: false,
      isTimerRunning: false,
      timerCountdown: 0,
      isRegionSelecting: false,
      regionImageDataUrl: null,
      undoStack: [],
      undoIndex: -1,
      activeTool: 'pen'
    }),

  closeEditor: () =>
    set({
      isEditorOpen: false,
      imageDataUrl: null,
      undoStack: [],
      undoIndex: -1
    }),

  setCaptureMode: (mode) => set({ captureMode: mode }),
  setTimerSeconds: (s) => set({ timerSeconds: s }),
  setIsCapturing: (v) => set({ isCapturing: v }),
  setIsTimerRunning: (v) => set({ isTimerRunning: v }),
  setTimerCountdown: (v) => set({ timerCountdown: v }),
  setIsRegionSelecting: (v, imageDataUrl) =>
    set({ isRegionSelecting: v, regionImageDataUrl: imageDataUrl ?? null }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setPenColor: (color) => set({ penColor: color }),
  setPenSize: (size) => set({ penSize: size }),
  setFontSize: (size) => set({ fontSize: size }),
  setTextColor: (color) => set({ textColor: color }),
  setEraserSize: (size) => set({ eraserSize: size }),

  // Undo — snapshot model
  pushUndoState: (entry) => {
    const { undoStack, undoIndex } = get()
    // If we're not at the end, discard redo states
    const trimmed = undoStack.slice(0, undoIndex + 1)
    trimmed.push(entry)
    // Limit to 30 states
    if (trimmed.length > 30) trimmed.shift()
    set({ undoStack: trimmed, undoIndex: trimmed.length - 1 })
  },

  undo: () => {
    const { undoStack, undoIndex } = get()
    if (undoIndex <= 0) return null
    const newIdx = undoIndex - 1
    set({ undoIndex: newIdx })
    return undoStack[newIdx]
  },

  redo: () => {
    const { undoStack, undoIndex } = get()
    if (undoIndex >= undoStack.length - 1) return null
    const newIdx = undoIndex + 1
    set({ undoIndex: newIdx })
    return undoStack[newIdx]
  },

  canUndo: () => get().undoIndex > 0,
  canRedo: () => get().undoIndex < get().undoStack.length - 1,
  clearUndoStack: () => set({ undoStack: [], undoIndex: -1 }),

  // Video
  setIsRecording: (v) => set({ isRecording: v }),
  setRecordingStartTime: (t) => set({ recordingStartTime: t }),

  startRecording: async (tabId: string) => {
    try {
      // 1. Get the desktopCapturer source ID from main process
      const sourceId = await window.terranoAPI.screenshot.startVideo(tabId)

      // 2. Get media stream using the source ID
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId
          }
        } as unknown as MediaTrackConstraints
      })

      // 3. Set up MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm'

      const recorder = new MediaRecorder(stream, { mimeType })
      _recordedChunks = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) _recordedChunks.push(e.data)
      }

      recorder.start(1000) // Collect data every second

      // 4. Store refs and update state
      _mediaRecorder = recorder
      _mediaStream = stream

      set({
        isRecording: true,
        recordingStartTime: Date.now(),
        isToolOpen: false
      })
    } catch (err) {
      console.error('[VideoRecording] Failed to start:', err)
      // Cleanup on failure
      _mediaRecorder = null
      _mediaStream = null
      _recordedChunks = []
    }
  },

  stopRecording: async () => {
    if (!_mediaRecorder || _mediaRecorder.state === 'inactive') return

    set({ isSavingVideo: true })

    await new Promise<void>((resolve) => {
      _mediaRecorder!.onstop = async () => {
        try {
          // Assemble video blob
          const blob = new Blob(_recordedChunks, { type: 'video/webm' })
          const arrayBuffer = await blob.arrayBuffer()
          const videoData = new Uint8Array(arrayBuffer)

          // Send to main process for save dialog
          await window.terranoAPI.screenshot.stopVideo(videoData)
        } catch (err) {
          console.error('[VideoRecording] Failed to save:', err)
        } finally {
          // Cleanup
          _mediaStream?.getTracks().forEach((t) => t.stop())
          _mediaRecorder = null
          _mediaStream = null
          _recordedChunks = []

          set({ isRecording: false, recordingStartTime: null, isSavingVideo: false })
          resolve()
        }
      }
      _mediaRecorder!.stop()
    })
  }
}))
