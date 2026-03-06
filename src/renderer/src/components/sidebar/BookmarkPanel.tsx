import { useState, useEffect } from 'react'
import { Folder, Globe, Star, Trash2, Plus } from 'lucide-react'
import { useTabStore } from '@renderer/stores/tab-store'
import { useNavStore } from '@renderer/stores/nav-store'
import type { BookmarkNode } from '@shared/types'
import styles from './Sidebar.module.css'

export function BookmarkPanel() {
  const [bookmarks, setBookmarks] = useState<BookmarkNode[]>([])
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set([1]))
  const activeTabId = useTabStore((s) => s.activeTabId)
  const navigate = useNavStore((s) => s.navigate)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const all = await window.terranoAPI.bookmarks.getAll()
    setBookmarks(all)
  }

  function toggleFolder(id: number) {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleDelete(id: number) {
    await window.terranoAPI.bookmarks.delete(id)
    load()
  }

  function handleClick(url: string | null) {
    if (url && activeTabId) {
      navigate(activeTabId, url)
    }
  }

  function renderNode(node: BookmarkNode, depth = 0): React.ReactNode {
    if (node.isFolder) {
      const isExpanded = expandedFolders.has(node.id)
      return (
        <div key={node.id}>
          <div
            className={styles.item}
            style={{ paddingLeft: 16 + depth * 16 }}
            onClick={() => toggleFolder(node.id)}
          >
            <span className={styles.itemIcon}>
              <Folder size={16} />
            </span>
            <div className={styles.itemInfo}>
              <div className={styles.itemTitle}>{node.title}</div>
            </div>
          </div>
          {isExpanded && node.children?.map((child) => renderNode(child, depth + 1))}
        </div>
      )
    }

    return (
      <div
        key={node.id}
        className={styles.item}
        style={{ paddingLeft: 16 + depth * 16 }}
        onClick={() => handleClick(node.url)}
      >
        <span className={styles.itemIcon}>
          <Globe size={16} />
        </span>
        <div className={styles.itemInfo}>
          <div className={styles.itemTitle}>{node.title}</div>
          <div className={styles.itemSubtitle}>{node.url}</div>
        </div>
        <button
          className={styles.itemAction}
          onClick={(e) => {
            e.stopPropagation()
            handleDelete(node.id)
          }}
          aria-label="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>
    )
  }

  return (
    <>
      {bookmarks.length === 0 ? (
        <div className={styles.emptyState}>
          <Star size={32} />
          <span>No bookmarks yet</span>
        </div>
      ) : (
        bookmarks.map((node) => renderNode(node))
      )}
    </>
  )
}
