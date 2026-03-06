import { useScreenshotStore } from '@renderer/stores/screenshot-store'
import { Circle, Square, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import styles from './VideoRecorder.module.css'

export function VideoRecorder(): JSX.Element | null {
  const isRecording = useScreenshotStore((s) => s.isRecording)
  const isSavingVideo = useScreenshotStore((s) => s.isSavingVideo)
  const recordingStartTime = useScreenshotStore((s) => s.recordingStartTime)
  const stopRecording = useScreenshotStore((s) => s.stopRecording)
  const [elapsed, setElapsed] = useState('00:00')

  useEffect(() => {
    if (!isRecording || !recordingStartTime) return
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - recordingStartTime) / 1000)
      const m = String(Math.floor(diff / 60)).padStart(2, '0')
      const s = String(diff % 60).padStart(2, '0')
      setElapsed(`${m}:${s}`)
    }, 500)
    return () => clearInterval(interval)
  }, [isRecording, recordingStartTime])

  if (!isRecording && !isSavingVideo) return null

  return (
    <div className={styles.indicator}>
      {isSavingVideo ? (
        <>
          <Loader2 size={12} className={styles.spinner} />
          <span className={styles.time}>Sauvegarde...</span>
        </>
      ) : (
        <>
          <Circle size={12} className={styles.dot} />
          <span className={styles.time}>{elapsed}</span>
          <button
            className={styles.stopBtn}
            onClick={stopRecording}
            title="Arreter l'enregistrement"
          >
            <Square size={12} />
            <span>Arreter</span>
          </button>
        </>
      )}
    </div>
  )
}
