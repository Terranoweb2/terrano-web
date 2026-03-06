import { useState, useRef, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { useTabStore } from '@renderer/stores/tab-store'
import { TabItem } from './TabItem'
import styles from './TabBar.module.css'

export function TabBar() {
  const tabs = useTabStore((s) => s.tabs)
  const createTab = useTabStore((s) => s.createTab)
  const closeTab = useTabStore((s) => s.closeTab)
  const pinTab = useTabStore((s) => s.pinTab)
  const unpinTab = useTabStore((s) => s.unpinTab)

  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    tabId: string
    isPinned: boolean
  } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Sort tabs: pinned first, then unpinned (preserve order within each group)
  const sortedTabs = [...tabs].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1
    if (!a.isPinned && b.isPinned) return 1
    return 0
  })

  function handleContextMenu(e: React.MouseEvent, tabId: string, isPinned: boolean) {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, tabId, isPinned })
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }
    if (contextMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [contextMenu])

  return (
    <div className={styles.tabBar}>
      <div className={styles.tabList}>
        {sortedTabs.map((tab) => (
          <div
            key={tab.id}
            onContextMenu={(e) => handleContextMenu(e, tab.id, tab.isPinned)}
          >
            <TabItem tab={tab} />
          </div>
        ))}
      </div>
      <button className={styles.newTabBtn} onClick={() => createTab()} aria-label="New tab">
        <Plus size={16} />
      </button>

      {contextMenu && (
        <div
          ref={menuRef}
          className={styles.contextMenu}
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            className={styles.contextMenuItem}
            onClick={() => {
              if (contextMenu.isPinned) {
                unpinTab(contextMenu.tabId)
              } else {
                pinTab(contextMenu.tabId)
              }
              setContextMenu(null)
            }}
          >
            {contextMenu.isPinned ? 'Désépingler l\'onglet' : 'Épingler l\'onglet'}
          </button>
          <button
            className={styles.contextMenuItem}
            onClick={() => {
              closeTab(contextMenu.tabId)
              setContextMenu(null)
            }}
          >
            Fermer l'onglet
          </button>
        </div>
      )}
    </div>
  )
}
