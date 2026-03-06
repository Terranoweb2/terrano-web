import { useRef, useEffect, useCallback, useState } from 'react'
import { useScreenshotStore } from '@renderer/stores/screenshot-store'
import { EditorToolbar } from './EditorToolbar'
import styles from './ScreenshotEditor.module.css'

export function ScreenshotEditor(): JSX.Element {
  const imageDataUrl = useScreenshotStore((s) => s.imageDataUrl)
  const activeTool = useScreenshotStore((s) => s.activeTool)
  const penColor = useScreenshotStore((s) => s.penColor)
  const penSize = useScreenshotStore((s) => s.penSize)
  const fontSize = useScreenshotStore((s) => s.fontSize)
  const eraserSize = useScreenshotStore((s) => s.eraserSize)
  const closeEditor = useScreenshotStore((s) => s.closeEditor)
  const pushUndoState = useScreenshotStore((s) => s.pushUndoState)
  const undoFn = useScreenshotStore((s) => s.undo)
  const redoFn = useScreenshotStore((s) => s.redo)

  const imageCanvasRef = useRef<HTMLCanvasElement>(null)
  const annotationCanvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [isDrawing, setIsDrawing] = useState(false)
  const [textInput, setTextInput] = useState<{
    x: number
    y: number
    value: string
  } | null>(null)
  const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null)
  const [cropEnd, setCropEnd] = useState<{ x: number; y: number } | null>(null)
  const [isCropping, setIsCropping] = useState(false)

  const imgRef = useRef<HTMLImageElement | null>(null)
  const canvasW = useRef(0)
  const canvasH = useRef(0)

  // Load image into canvas
  useEffect(() => {
    if (!imageDataUrl) return
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      const ic = imageCanvasRef.current
      const ac = annotationCanvasRef.current
      if (!ic || !ac) return

      canvasW.current = img.naturalWidth
      canvasH.current = img.naturalHeight

      ic.width = img.naturalWidth
      ic.height = img.naturalHeight
      ac.width = img.naturalWidth
      ac.height = img.naturalHeight

      const ctx = ic.getContext('2d')
      if (ctx) ctx.drawImage(img, 0, 0)

      // Push initial empty state to undo stack
      pushUndoState({ dataUrl: ac.toDataURL() })
    }
    img.src = imageDataUrl
  }, [imageDataUrl, pushUndoState])

  // Save snapshot of annotation canvas for undo
  const saveAnnotationState = useCallback(() => {
    const ac = annotationCanvasRef.current
    if (!ac) return
    pushUndoState({ dataUrl: ac.toDataURL() })
  }, [pushUndoState])

  // Restore annotation canvas from data URL
  const restoreAnnotation = useCallback((dataUrl: string) => {
    const ac = annotationCanvasRef.current
    if (!ac) return
    const ctx = ac.getContext('2d')
    if (!ctx) return
    const img = new Image()
    img.onload = () => {
      ctx.clearRect(0, 0, ac.width, ac.height)
      ctx.drawImage(img, 0, 0)
    }
    img.src = dataUrl
  }, [])

  // Get canvas-relative coordinates from mouse event
  const getCanvasCoords = useCallback(
    (e: React.MouseEvent): { x: number; y: number } => {
      const ac = annotationCanvasRef.current
      if (!ac) return { x: 0, y: 0 }
      const rect = ac.getBoundingClientRect()
      const scaleX = ac.width / rect.width
      const scaleY = ac.height / rect.height
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      }
    },
    []
  )

  // ── Drawing handlers ──
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const { x, y } = getCanvasCoords(e)
      const ac = annotationCanvasRef.current
      if (!ac) return
      const ctx = ac.getContext('2d')
      if (!ctx) return

      if (activeTool === 'pen') {
        setIsDrawing(true)
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.strokeStyle = penColor
        ctx.lineWidth = penSize
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.globalCompositeOperation = 'source-over'
      } else if (activeTool === 'eraser') {
        setIsDrawing(true)
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineWidth = eraserSize
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.globalCompositeOperation = 'destination-out'
      } else if (activeTool === 'text') {
        setTextInput({ x, y, value: '' })
      } else if (activeTool === 'crop') {
        setCropStart({ x, y })
        setCropEnd({ x, y })
        setIsCropping(true)
      }
    },
    [activeTool, penColor, penSize, eraserSize, getCanvasCoords]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (activeTool === 'crop' && isCropping) {
        const { x, y } = getCanvasCoords(e)
        setCropEnd({ x, y })
        return
      }
      if (!isDrawing) return
      const { x, y } = getCanvasCoords(e)
      const ac = annotationCanvasRef.current
      if (!ac) return
      const ctx = ac.getContext('2d')
      if (!ctx) return
      ctx.lineTo(x, y)
      ctx.stroke()
    },
    [isDrawing, isCropping, activeTool, getCanvasCoords]
  )

  const handleMouseUp = useCallback(() => {
    if (activeTool === 'crop' && isCropping && cropStart && cropEnd) {
      setIsCropping(false)
      // Apply crop
      const x = Math.min(cropStart.x, cropEnd.x)
      const y = Math.min(cropStart.y, cropEnd.y)
      const w = Math.abs(cropEnd.x - cropStart.x)
      const h = Math.abs(cropEnd.y - cropStart.y)

      if (w > 10 && h > 10) {
        const ic = imageCanvasRef.current
        const ac = annotationCanvasRef.current
        if (!ic || !ac) return

        // Crop image canvas
        const icCtx = ic.getContext('2d')
        const acCtx = ac.getContext('2d')
        if (!icCtx || !acCtx) return

        const imgData = icCtx.getImageData(x, y, w, h)
        const annData = acCtx.getImageData(x, y, w, h)

        ic.width = w
        ic.height = h
        ac.width = w
        ac.height = h
        canvasW.current = w
        canvasH.current = h

        icCtx.putImageData(imgData, 0, 0)
        acCtx.putImageData(annData, 0, 0)
        saveAnnotationState()
      }

      setCropStart(null)
      setCropEnd(null)
      return
    }

    if (isDrawing) {
      setIsDrawing(false)
      // Restore composite mode
      const ac = annotationCanvasRef.current
      if (ac) {
        const ctx = ac.getContext('2d')
        if (ctx) ctx.globalCompositeOperation = 'source-over'
      }
      saveAnnotationState()
    }
  }, [isDrawing, isCropping, activeTool, cropStart, cropEnd, saveAnnotationState])

  // ── Text input commit ──
  const commitText = useCallback(() => {
    if (!textInput || !textInput.value.trim()) {
      setTextInput(null)
      return
    }
    const ac = annotationCanvasRef.current
    if (!ac) return
    const ctx = ac.getContext('2d')
    if (!ctx) return

    ctx.globalCompositeOperation = 'source-over'
    ctx.font = `${fontSize}px sans-serif`
    ctx.fillStyle = penColor
    ctx.fillText(textInput.value, textInput.x, textInput.y)
    setTextInput(null)
    saveAnnotationState()
  }, [textInput, fontSize, penColor, saveAnnotationState])

  // ── Composite both canvases for save/copy ──
  const getCompositeDataUrl = useCallback((): string => {
    const ic = imageCanvasRef.current
    const ac = annotationCanvasRef.current
    if (!ic || !ac) return ''

    const composite = document.createElement('canvas')
    composite.width = ic.width
    composite.height = ic.height
    const ctx = composite.getContext('2d')
    if (!ctx) return ''

    ctx.drawImage(ic, 0, 0)
    ctx.drawImage(ac, 0, 0)
    return composite.toDataURL('image/png')
  }, [])

  // ── Actions ──
  const handleSave = useCallback(async () => {
    const dataUrl = getCompositeDataUrl()
    if (!dataUrl) return
    await window.terranoAPI.screenshot.saveToFile(dataUrl)
  }, [getCompositeDataUrl])

  const handleCopy = useCallback(async () => {
    const dataUrl = getCompositeDataUrl()
    if (!dataUrl) return
    await window.terranoAPI.screenshot.copyToClipboard(dataUrl)
  }, [getCompositeDataUrl])

  const handleUndo = useCallback(() => {
    const entry = undoFn()
    if (entry) restoreAnnotation(entry.dataUrl)
  }, [undoFn, restoreAnnotation])

  const handleRedo = useCallback(() => {
    const entry = redoFn()
    if (entry) restoreAnnotation(entry.dataUrl)
  }, [redoFn, restoreAnnotation])

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        if (textInput) {
          setTextInput(null)
        } else {
          closeEditor()
        }
        return
      }
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          e.preventDefault()
          handleUndo()
        } else if (e.key === 'y') {
          e.preventDefault()
          handleRedo()
        } else if (e.key === 's') {
          e.preventDefault()
          handleSave()
        } else if (e.key === 'c' && !textInput) {
          e.preventDefault()
          handleCopy()
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [closeEditor, handleUndo, handleRedo, handleSave, handleCopy, textInput])

  // Crop selection rectangle for visual feedback
  const cropRect =
    activeTool === 'crop' && cropStart && cropEnd
      ? {
          left: Math.min(cropStart.x, cropEnd.x),
          top: Math.min(cropStart.y, cropEnd.y),
          width: Math.abs(cropEnd.x - cropStart.x),
          height: Math.abs(cropEnd.y - cropStart.y)
        }
      : null

  // Cursor style
  let cursor = 'default'
  if (activeTool === 'pen') cursor = 'crosshair'
  else if (activeTool === 'eraser') cursor = 'cell'
  else if (activeTool === 'text') cursor = 'text'
  else if (activeTool === 'crop') cursor = 'crosshair'

  return (
    <div className={styles.editor}>
      <EditorToolbar
        onUndo={handleUndo}
        onRedo={handleRedo}
        onSave={handleSave}
        onCopy={handleCopy}
        onClose={closeEditor}
      />

      <div className={styles.canvasContainer} ref={containerRef}>
        <div
          className={styles.canvasWrapper}
          style={{ cursor }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <canvas ref={imageCanvasRef} className={styles.canvas} />
          <canvas ref={annotationCanvasRef} className={styles.canvas} />

          {/* Crop visual overlay */}
          {cropRect && cropRect.width > 0 && (
            <div
              className={styles.cropOverlay}
              style={{
                left: `${(cropRect.left / canvasW.current) * 100}%`,
                top: `${(cropRect.top / canvasH.current) * 100}%`,
                width: `${(cropRect.width / canvasW.current) * 100}%`,
                height: `${(cropRect.height / canvasH.current) * 100}%`
              }}
            />
          )}

          {/* Text input overlay */}
          {textInput && (
            <input
              autoFocus
              className={styles.textInput}
              value={textInput.value}
              onChange={(e) => setTextInput({ ...textInput, value: e.target.value })}
              onBlur={commitText}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitText()
                if (e.key === 'Escape') setTextInput(null)
              }}
              style={{
                left: `${(textInput.x / canvasW.current) * 100}%`,
                top: `${(textInput.y / canvasH.current) * 100}%`,
                fontSize: `${fontSize}px`,
                color: penColor
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
