import { X, Globe, Loader, EyeOff } from 'lucide-react'
import { useTabStore } from '@renderer/stores/tab-store'
import type { TabState } from '@shared/types'
import styles from './TabBar.module.css'

interface TabItemProps {
  tab: TabState
}

export function TabItem({ tab }: TabItemProps) {
  const activateTab = useTabStore((s) => s.activateTab)
  const closeTab = useTabStore((s) => s.closeTab)
  const tabCount = useTabStore((s) => s.tabs.length)

  const classNames = [
    styles.tab,
    tab.isActive ? styles.active : '',
    tab.isPrivate ? styles.private : '',
    tab.isPinned ? styles.pinned : ''
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={classNames}
      onClick={() => activateTab(tab.id)}
      title={tab.title || tab.url}
    >
      <span className={styles.tabIcon}>
        {tab.isLoading ? (
          <Loader size={14} className={styles.spinner} />
        ) : tab.isPrivate ? (
          <EyeOff size={14} />
        ) : tab.faviconUrl ? (
          <img src={tab.faviconUrl} width={14} height={14} alt="" />
        ) : (
          <Globe size={14} />
        )}
      </span>
      {!tab.isPinned && (
        <span className={styles.tabTitle}>
          {tab.isPrivate && !tab.title ? 'Private Tab' : tab.title || 'New Tab'}
        </span>
      )}
      {!tab.isPinned && tabCount > 1 && (
        <button
          className={styles.tabClose}
          onClick={(e) => {
            e.stopPropagation()
            closeTab(tab.id)
          }}
          aria-label="Close tab"
        >
          <X size={12} />
        </button>
      )}
    </div>
  )
}
