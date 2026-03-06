import { useScreenshotStore } from '@renderer/stores/screenshot-store'
import { CaptureToolbar } from './CaptureToolbar'
import { RegionSelector } from './RegionSelector'
import { TimerCountdown } from './TimerCountdown'
import { ScreenshotEditor } from './ScreenshotEditor'
import { VideoRecorder } from './VideoRecorder'
import styles from './ScreenshotOverlay.module.css'

export function ScreenshotOverlay(): JSX.Element | null {
  const isToolOpen = useScreenshotStore((s) => s.isToolOpen)
  const isEditorOpen = useScreenshotStore((s) => s.isEditorOpen)
  const isRegionSelecting = useScreenshotStore((s) => s.isRegionSelecting)
  const isTimerRunning = useScreenshotStore((s) => s.isTimerRunning)
  const isRecording = useScreenshotStore((s) => s.isRecording)
  const isSavingVideo = useScreenshotStore((s) => s.isSavingVideo)

  // Nothing active → render nothing
  if (
    !isToolOpen &&
    !isEditorOpen &&
    !isRegionSelecting &&
    !isTimerRunning &&
    !isRecording &&
    !isSavingVideo
  )
    return null

  return (
    <div className={styles.overlay} style={isRecording || isSavingVideo ? { pointerEvents: 'none' } : undefined}>
      {/* Timer countdown overlay */}
      {isTimerRunning && <TimerCountdown />}

      {/* Region selection overlay */}
      {isRegionSelecting && <RegionSelector />}

      {/* Capture mode toolbar (before capture) */}
      {isToolOpen && !isEditorOpen && !isRegionSelecting && !isTimerRunning && <CaptureToolbar />}

      {/* Screenshot editor (after capture) */}
      {isEditorOpen && <ScreenshotEditor />}

      {/* Video recording indicator (floating, no pointer-events block) */}
      {(isRecording || isSavingVideo) && (
        <div style={{ pointerEvents: 'auto' }}>
          <VideoRecorder />
        </div>
      )}
    </div>
  )
}
