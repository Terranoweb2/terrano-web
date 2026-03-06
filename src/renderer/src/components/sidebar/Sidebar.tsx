import { useSidebarStore } from '@renderer/stores/sidebar-store'
import { HistoryPanel } from './HistoryPanel'
import { BookmarkPanel } from './BookmarkPanel'
import { DownloadPanel } from './DownloadPanel'
import { ReadingListPanel } from './ReadingListPanel'
import { SettingsPanel } from './SettingsPanel'
import { EmailPanel } from './EmailPanel'
import { X } from 'lucide-react'
import styles from './Sidebar.module.css'

const PANEL_TITLES: Record<string, string> = {
  history: 'Historique',
  bookmarks: 'Favoris',
  downloads: 'Téléchargements',
  readingList: 'Liste de lecture',
  settings: 'Paramètres',
  email: 'Email'
}

export function Sidebar() {
  const activePanel = useSidebarStore((s) => s.activePanel)
  const close = useSidebarStore((s) => s.close)

  if (!activePanel) return null

  return (
    <div className={styles.sidebar}>
      <div className={styles.header}>
        <span className={styles.title}>{PANEL_TITLES[activePanel]}</span>
        <button className={styles.closeBtn} onClick={close} aria-label="Close sidebar">
          <X size={16} />
        </button>
      </div>
      <div className={styles.content}>
        {activePanel === 'history' && <HistoryPanel />}
        {activePanel === 'bookmarks' && <BookmarkPanel />}
        {activePanel === 'downloads' && <DownloadPanel />}
        {activePanel === 'readingList' && <ReadingListPanel />}
        {activePanel === 'settings' && <SettingsPanel />}
        {activePanel === 'email' && <EmailPanel />}
      </div>
    </div>
  )
}
