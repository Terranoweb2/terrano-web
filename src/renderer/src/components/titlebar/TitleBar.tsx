import { useState, useEffect } from 'react'
import { Minus, Square, X, Copy } from 'lucide-react'
import styles from './TitleBar.module.css'

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    window.terranoAPI.window.isMaximized().then(setIsMaximized)
    const cleanup = window.terranoAPI.window.onMaximizeChanged(setIsMaximized)
    return cleanup
  }, [])

  return (
    <div className={styles.titlebar}>
      <div className={styles.dragRegion} />
      <div className={styles.controls}>
        <button
          className={styles.controlBtn}
          onClick={() => window.terranoAPI.window.minimize()}
          aria-label="Minimize"
        >
          <Minus size={16} />
        </button>
        <button
          className={styles.controlBtn}
          onClick={() => window.terranoAPI.window.maximize()}
          aria-label={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? <Copy size={14} /> : <Square size={14} />}
        </button>
        <button
          className={`${styles.controlBtn} ${styles.closeBtn}`}
          onClick={() => window.terranoAPI.window.close()}
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
