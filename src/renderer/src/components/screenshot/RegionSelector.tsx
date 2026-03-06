import { useRef, useState, useCallback } from 'react'
import { useScreenshotStore } from '@renderer/stores/screenshot-store'
import styles from './RegionSelector.module.css'

export function RegionSelector(): JSX.Element {
  const regionImageDataUrl = useScreenshotStore((s) => s.regionImageDataUrl)
  const setIsRegionSelecting = useScreenshotStore((s) => s.setIsRegionSelecting)
  const openEditor = useScreenshotStore((s) => s.openEditor)
  const containerRef = useRef<HTMLDivElement>(null)

  const [start, setStart] = useState<{ x: number; y: number } | null>(null)
  const [current, setCurrent] = useState<{ x: number; y: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    setStart({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    setCurrent({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    setIsDragging(true)
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      setCurrent({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    },
    [isDragging]
  )

  const handleMouseUp = useCallback(() => {
    if (!isDragging || !start || !current || !regionImageDataUrl) return
    setIsDragging(false)

    // Calculate selection rectangle
    const x = Math.min(start.x, current.x)
    const y = Math.min(start.y, current.y)
    const w = Math.abs(current.x - start.x)
    const h = Math.abs(current.y - start.y)

    if (w < 10 || h < 10) {
      // Too small — cancel
      setIsRegionSelecting(false)
      return
    }

    // We need to crop the base64 image client-side using a canvas
    const img = new Image()
    img.onload = () => {
      // Scale coords from display size to actual image size
      const container = containerRef.current
      if (!container) return
      const displayW = container.clientWidth
      const displayH = container.clientHeight
      const scaleX = img.naturalWidth / displayW
      const scaleY = img.naturalHeight / displayH

      const cropX = Math.round(x * scaleX)
      const cropY = Math.round(y * scaleY)
      const cropW = Math.round(w * scaleX)
      const cropH = Math.round(h * scaleY)

      const canvas = document.createElement('canvas')
      canvas.width = cropW
      canvas.height = cropH
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH)

      const croppedDataUrl = canvas.toDataURL('image/png')
      openEditor(croppedDataUrl)
    }
    img.src = regionImageDataUrl
  }, [isDragging, start, current, regionImageDataUrl, setIsRegionSelecting, openEditor])

  // Selection rectangle
  const selRect =
    start && current
      ? {
          left: Math.min(start.x, current.x),
          top: Math.min(start.y, current.y),
          width: Math.abs(current.x - start.x),
          height: Math.abs(current.y - start.y)
        }
      : null

  return (
    <div
      ref={containerRef}
      className={styles.container}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Frozen screenshot as background */}
      {regionImageDataUrl && (
        <img
          src={regionImageDataUrl}
          className={styles.frozenImage}
          alt=""
          draggable={false}
        />
      )}

      {/* Dark overlay */}
      <div className={styles.darkOverlay} />

      {/* Selection rectangle (bright area) */}
      {selRect && selRect.width > 0 && selRect.height > 0 && (
        <div
          className={styles.selection}
          style={{
            left: selRect.left,
            top: selRect.top,
            width: selRect.width,
            height: selRect.height
          }}
        >
          {regionImageDataUrl && (
            <img
              src={regionImageDataUrl}
              className={styles.selectionImage}
              alt=""
              draggable={false}
              style={{
                marginLeft: -selRect.left,
                marginTop: -selRect.top
              }}
            />
          )}
        </div>
      )}

      {/* Instructions */}
      {!isDragging && (
        <div className={styles.hint}>Dessinez un rectangle pour selectionner la zone</div>
      )}

      {/* Cancel with Escape */}
      <button
        className={styles.cancelBtn}
        onClick={() => setIsRegionSelecting(false)}
      >
        Annuler (Echap)
      </button>
    </div>
  )
}
