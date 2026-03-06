import { useCallback } from 'react'
import { Monitor, FileText, Square, Timer, Camera, X, Video } from 'lucide-react'
import { useScreenshotStore } from '@renderer/stores/screenshot-store'
import { useTabStore } from '@renderer/stores/tab-store'
import type { CaptureMode } from '@shared/types'
import styles from './CaptureToolbar.module.css'

const TIMER_OPTIONS = [0, 3, 5, 10]

const MODES: { id: CaptureMode; label: string; icon: typeof Monitor }[] = [
  { id: 'visible', label: 'Page visible', icon: Monitor },
  { id: 'fullpage', label: 'Page entiere', icon: FileText },
  { id: 'region', label: 'Zone', icon: Square },
  { id: 'video', label: 'Video', icon: Video }
]

export function CaptureToolbar(): JSX.Element {
  const captureMode = useScreenshotStore((s) => s.captureMode)
  const timerSeconds = useScreenshotStore((s) => s.timerSeconds)
  const setCaptureMode = useScreenshotStore((s) => s.setCaptureMode)
  const setTimerSeconds = useScreenshotStore((s) => s.setTimerSeconds)
  const closeTool = useScreenshotStore((s) => s.closeTool)
  const setIsCapturing = useScreenshotStore((s) => s.setIsCapturing)
  const setIsTimerRunning = useScreenshotStore((s) => s.setIsTimerRunning)
  const setTimerCountdown = useScreenshotStore((s) => s.setTimerCountdown)
  const setIsRegionSelecting = useScreenshotStore((s) => s.setIsRegionSelecting)
  const openEditor = useScreenshotStore((s) => s.openEditor)
  const startRecording = useScreenshotStore((s) => s.startRecording)
  const activeTabId = useTabStore((s) => s.activeTabId)

  const isVideoMode = captureMode === 'video'

  const startCapture = useCallback(async () => {
    if (!activeTabId) return

    // Video mode → start recording directly
    if (captureMode === 'video') {
      await startRecording(activeTabId)
      return
    }

    const doCapture = async (): Promise<void> => {
      setIsCapturing(true)
      try {
        if (captureMode === 'region') {
          // First capture visible, then show region selector
          const dataUrl = await window.terranoAPI.screenshot.captureVisible(activeTabId)
          setIsRegionSelecting(true, dataUrl)
        } else if (captureMode === 'fullpage') {
          const dataUrl = await window.terranoAPI.screenshot.captureFullPage(activeTabId)
          openEditor(dataUrl)
        } else {
          const dataUrl = await window.terranoAPI.screenshot.captureVisible(activeTabId)
          openEditor(dataUrl)
        }
      } catch (err) {
        console.error('Capture failed:', err)
      } finally {
        setIsCapturing(false)
      }
    }

    if (timerSeconds > 0) {
      // Start timer countdown
      setIsTimerRunning(true)
      setTimerCountdown(timerSeconds)

      let remaining = timerSeconds
      const interval = setInterval(() => {
        remaining--
        setTimerCountdown(remaining)
        if (remaining <= 0) {
          clearInterval(interval)
          setIsTimerRunning(false)
          doCapture()
        }
      }, 1000)
    } else {
      await doCapture()
    }
  }, [
    activeTabId,
    captureMode,
    timerSeconds,
    setIsCapturing,
    setIsTimerRunning,
    setTimerCountdown,
    setIsRegionSelecting,
    openEditor,
    startRecording
  ])

  return (
    <div className={styles.toolbar}>
      {/* Mode selector */}
      <div className={styles.group}>
        {MODES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`${styles.modeBtn} ${captureMode === id ? styles.active : ''} ${id === 'video' ? styles.videoMode : ''}`}
            onClick={() => setCaptureMode(id)}
            title={label}
          >
            <Icon size={16} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Separator */}
      <div className={styles.sep} />

      {/* Timer selector — hidden in video mode */}
      {!isVideoMode && (
        <>
          <div className={styles.group}>
            <Timer size={14} className={styles.timerIcon} />
            {TIMER_OPTIONS.map((s) => (
              <button
                key={s}
                className={`${styles.timerBtn} ${timerSeconds === s ? styles.active : ''}`}
                onClick={() => setTimerSeconds(s)}
              >
                {s === 0 ? 'Sans' : `${s}s`}
              </button>
            ))}
          </div>

          {/* Separator */}
          <div className={styles.sep} />
        </>
      )}

      {/* Action buttons */}
      <div className={styles.group}>
        <button
          className={isVideoMode ? styles.recordBtn : styles.captureBtn}
          onClick={startCapture}
        >
          {isVideoMode ? <Video size={16} /> : <Camera size={16} />}
          <span>{isVideoMode ? 'Enregistrer' : 'Capturer'}</span>
        </button>
        <button className={styles.cancelBtn} onClick={closeTool} title="Annuler">
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
