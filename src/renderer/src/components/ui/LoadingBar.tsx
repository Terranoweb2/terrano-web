import { useTabStore } from '@renderer/stores/tab-store'
import styles from './LoadingBar.module.css'

export function LoadingBar() {
  const activeTabId = useTabStore((s) => s.activeTabId)
  const tabs = useTabStore((s) => s.tabs)
  const activeTab = tabs.find((t) => t.id === activeTabId)
  const isLoading = activeTab?.isLoading ?? false

  if (!isLoading) return null

  return (
    <div className={styles.bar}>
      <div className={styles.progress} />
    </div>
  )
}
