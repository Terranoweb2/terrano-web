import { useScreenshotStore } from '@renderer/stores/screenshot-store'
import styles from './TimerCountdown.module.css'

export function TimerCountdown(): JSX.Element {
  const timerCountdown = useScreenshotStore((s) => s.timerCountdown)

  return (
    <div className={styles.container}>
      <div className={styles.number} key={timerCountdown}>
        {timerCountdown}
      </div>
    </div>
  )
}
