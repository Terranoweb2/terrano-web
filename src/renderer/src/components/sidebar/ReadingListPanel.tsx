import { useState, useEffect } from 'react'
import { Globe, Trash2, BookOpen, Check } from 'lucide-react'
import { useTabStore } from '@renderer/stores/tab-store'
import { useNavStore } from '@renderer/stores/nav-store'
import type { ReadingListItem } from '@shared/types/reading-list'
import styles from './Sidebar.module.css'

export function ReadingListPanel() {
  const [items, setItems] = useState<ReadingListItem[]>([])
  const activeTabId = useTabStore((s) => s.activeTabId)
  const navigate = useNavStore((s) => s.navigate)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const results = await window.terranoAPI.readingList.getAll()
    setItems(results)
  }

  async function handleDelete(id: number) {
    await window.terranoAPI.readingList.delete(id)
    setItems((prev) => prev.filter((e) => e.id !== id))
  }

  async function handleMarkRead(id: number) {
    await window.terranoAPI.readingList.markRead(id)
    setItems((prev) => prev.map((e) => (e.id === id ? { ...e, isRead: true } : e)))
  }

  function handleClick(url: string, id: number) {
    if (activeTabId) {
      navigate(activeTabId, url)
      handleMarkRead(id)
    }
  }

  function formatTime(ts: number): string {
    const d = new Date(ts)
    const now = new Date()
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  const unread = items.filter((i) => !i.isRead)
  const read = items.filter((i) => i.isRead)

  return (
    <>
      {items.length === 0 ? (
        <div className={styles.emptyState}>
          <BookOpen size={32} />
          <span>Aucun article dans la liste de lecture</span>
        </div>
      ) : (
        <>
          {unread.length > 0 && (
            <>
              {unread.map((item) => (
                <div
                  key={item.id}
                  className={styles.item}
                  onClick={() => handleClick(item.url, item.id)}
                >
                  <span className={styles.itemIcon}>
                    {item.faviconUrl ? (
                      <img src={item.faviconUrl} alt="" />
                    ) : (
                      <Globe size={16} />
                    )}
                  </span>
                  <div className={styles.itemInfo}>
                    <div className={styles.itemTitle}>{item.title || item.url}</div>
                    <div className={styles.itemSubtitle}>
                      {formatTime(item.addedAt)} — {item.url}
                    </div>
                  </div>
                  <button
                    className={styles.itemAction}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleMarkRead(item.id)
                    }}
                    aria-label="Marquer comme lu"
                    title="Marquer comme lu"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    className={styles.itemAction}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(item.id)
                    }}
                    aria-label="Supprimer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </>
          )}
          {read.length > 0 && (
            <>
              <div style={{ padding: '8px 16px', fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                Lus
              </div>
              {read.map((item) => (
                <div
                  key={item.id}
                  className={styles.item}
                  onClick={() => handleClick(item.url, item.id)}
                  style={{ opacity: 0.6 }}
                >
                  <span className={styles.itemIcon}>
                    {item.faviconUrl ? (
                      <img src={item.faviconUrl} alt="" />
                    ) : (
                      <Globe size={16} />
                    )}
                  </span>
                  <div className={styles.itemInfo}>
                    <div className={styles.itemTitle}>{item.title || item.url}</div>
                    <div className={styles.itemSubtitle}>
                      {formatTime(item.addedAt)} — {item.url}
                    </div>
                  </div>
                  <button
                    className={styles.itemAction}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(item.id)
                    }}
                    aria-label="Supprimer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </>
  )
}
