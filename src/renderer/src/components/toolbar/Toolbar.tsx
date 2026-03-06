import { useState, useEffect } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  X as StopIcon,
  Star,
  Clock,
  Bookmark,
  Download,
  Settings,
  Shield,
  BookOpen,
  Camera,
  Mail
} from 'lucide-react'
import { useTabStore } from '@renderer/stores/tab-store'
import { useNavStore } from '@renderer/stores/nav-store'
import { useSidebarStore, type SidebarPanel } from '@renderer/stores/sidebar-store'
import { useScreenshotStore } from '@renderer/stores/screenshot-store'
import { useEmailStore } from '@renderer/stores/email-store'
import { Omnibox } from './Omnibox'
import styles from './Toolbar.module.css'

function EmailButton() {
  const unreadCount = useEmailStore((s) => s.unreadCount)
  const togglePanel = useSidebarStore((s) => s.toggle)
  const activePanel = useSidebarStore((s) => s.activePanel)

  return (
    <div className={styles.shieldWrapper}>
      <button
        className={`${styles.navBtn} ${activePanel === 'email' ? styles.navBtnActive : ''}`}
        onClick={() => togglePanel('email')}
        aria-label="Email"
        title={`Email${unreadCount > 0 ? ` — ${unreadCount} non lu(s)` : ''}`}
      >
        <Mail size={16} />
      </button>
      {unreadCount > 0 && (
        <span className={styles.shieldBadge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
      )}
    </div>
  )
}

export function Toolbar() {
  const activeTabId = useTabStore((s) => s.activeTabId)
  const navState = useNavStore((s) => (activeTabId ? s.states[activeTabId] : null))
  const zoomLevel = useNavStore((s) => (activeTabId ? s.zoomLevels[activeTabId] ?? 0 : 0))
  const togglePanel = useSidebarStore((s) => s.toggle)
  const activePanel = useSidebarStore((s) => s.activePanel)

  const goBack = useNavStore((s) => s.goBack)
  const goForward = useNavStore((s) => s.goForward)
  const reload = useNavStore((s) => s.reload)
  const stop = useNavStore((s) => s.stop)

  const canGoBack = navState?.canGoBack ?? false
  const canGoForward = navState?.canGoForward ?? false
  const isLoading = navState?.isLoading ?? false

  const [isBookmarked, setIsBookmarked] = useState(false)
  const [blockedCount, setBlockedCount] = useState(0)
  const currentUrl = navState?.url ?? ''

  useEffect(() => {
    if (currentUrl && !currentUrl.startsWith('terrano://')) {
      window.terranoAPI.bookmarks.isBookmarked(currentUrl).then(setIsBookmarked)
    } else {
      setIsBookmarked(false)
    }
  }, [currentUrl])

  // Ad blocker blocked count
  useEffect(() => {
    if (activeTabId) {
      window.terranoAPI.adblock.getBlockedCount(activeTabId).then(setBlockedCount)
    }
    const cleanup = window.terranoAPI.adblock.onCountUpdated((tabId, count) => {
      if (tabId === activeTabId) {
        setBlockedCount(count as number)
      }
    })
    return cleanup
  }, [activeTabId])

  // Screenshot via keyboard shortcut
  useEffect(() => {
    const cleanup = window.terranoAPI.onCapturePage?.(() => {
      handleScreenshot()
    })
    return cleanup
  }, [])

  async function toggleBookmark() {
    if (!currentUrl || currentUrl.startsWith('terrano://')) return
    if (isBookmarked) {
      await window.terranoAPI.bookmarks.deleteByUrl(currentUrl)
      setIsBookmarked(false)
    } else {
      const title = navState?.title ?? currentUrl
      await window.terranoAPI.bookmarks.create({ title, url: currentUrl })
      setIsBookmarked(true)
    }
  }

  async function handleAddToReadingList() {
    if (!currentUrl || currentUrl.startsWith('terrano://')) return
    const title = navState?.title ?? currentUrl
    const tab = useTabStore.getState().tabs.find((t) => t.id === activeTabId)
    await window.terranoAPI.readingList.add({
      url: currentUrl,
      title,
      faviconUrl: tab?.faviconUrl ?? null
    })
  }

  function handleScreenshot() {
    const { isToolOpen, openTool, closeTool } = useScreenshotStore.getState()
    if (isToolOpen) {
      closeTool()
    } else {
      openTool()
    }
  }

  function panelBtn(panel: SidebarPanel, icon: React.ReactNode, label: string) {
    return (
      <button
        className={`${styles.navBtn} ${activePanel === panel ? styles.navBtnActive : ''}`}
        onClick={() => togglePanel(panel)}
        aria-label={label}
      >
        {icon}
      </button>
    )
  }

  return (
    <div className={styles.toolbar}>
      <div className={styles.navButtons}>
        <button
          className={styles.navBtn}
          disabled={!canGoBack}
          onClick={() => activeTabId && goBack(activeTabId)}
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <button
          className={styles.navBtn}
          disabled={!canGoForward}
          onClick={() => activeTabId && goForward(activeTabId)}
          aria-label="Forward"
        >
          <ArrowRight size={18} />
        </button>
        {isLoading ? (
          <button
            className={styles.navBtn}
            onClick={() => activeTabId && stop(activeTabId)}
            aria-label="Stop"
          >
            <StopIcon size={16} />
          </button>
        ) : (
          <button
            className={styles.navBtn}
            onClick={() => activeTabId && reload(activeTabId)}
            aria-label="Reload"
          >
            <RotateCw size={16} />
          </button>
        )}
      </div>

      {zoomLevel !== 0 && (
        <button
          className={styles.zoomBadge}
          onClick={() => {
            if (activeTabId) window.terranoAPI.nav.resetZoom(activeTabId)
          }}
          title="Réinitialiser le zoom (Ctrl+0)"
        >
          {Math.round(Math.pow(1.2, zoomLevel) * 100)}%
        </button>
      )}

      <Omnibox />

      <div className={styles.actions}>
        <button
          className={`${styles.navBtn} ${isBookmarked ? styles.bookmarked : ''}`}
          onClick={toggleBookmark}
          aria-label={isBookmarked ? 'Bookmarked' : 'Add bookmark'}
        >
          <Star size={16} fill={isBookmarked ? 'currentColor' : 'none'} />
        </button>
        <button
          className={styles.navBtn}
          onClick={handleAddToReadingList}
          aria-label="Ajouter à la liste de lecture"
          title="Ajouter à la liste de lecture"
        >
          <BookOpen size={16} />
        </button>
        <button
          className={styles.navBtn}
          onClick={handleScreenshot}
          aria-label="Capturer la page"
          title="Capturer la page"
        >
          <Camera size={16} />
        </button>
        <div className={styles.shieldWrapper}>
          <button
            className={styles.navBtn}
            onClick={() => togglePanel('settings')}
            aria-label="Bloqueur de publicités"
            title={`Bloqueur de publicités — ${blockedCount} bloqué(s)`}
          >
            <Shield size={16} />
          </button>
          {blockedCount > 0 && (
            <span className={styles.shieldBadge}>{blockedCount > 99 ? '99+' : blockedCount}</span>
          )}
        </div>
        <EmailButton />
        {panelBtn('history', <Clock size={16} />, 'Historique')}
        {panelBtn('bookmarks', <Bookmark size={16} />, 'Favoris')}
        {panelBtn('downloads', <Download size={16} />, 'Téléchargements')}
        {panelBtn('readingList', <BookOpen size={16} />, 'Liste de lecture')}
        {panelBtn('settings', <Settings size={16} />, 'Paramètres')}
      </div>
    </div>
  )
}
