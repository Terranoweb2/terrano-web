import { useState, useEffect } from 'react'
import { Globe, Trash2, Clock } from 'lucide-react'
import { useTabStore } from '@renderer/stores/tab-store'
import { useNavStore } from '@renderer/stores/nav-store'
import type { HistoryEntry } from '@shared/types'
import styles from './Sidebar.module.css'

export function HistoryPanel() {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [query, setQuery] = useState('')
  const activeTabId = useTabStore((s) => s.activeTabId)
  const navigate = useNavStore((s) => s.navigate)

  useEffect(() => {
    load()
  }, [query])

  async function load() {
    const results = query.trim()
      ? await window.terranoAPI.history.search(query)
      : await window.terranoAPI.history.getRecent(100)
    setEntries(results)
  }

  async function handleDelete(id: number) {
    await window.terranoAPI.history.delete(id)
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  function handleClick(url: string) {
    if (activeTabId) {
      navigate(activeTabId, url)
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

  return (
    <>
      <div className={styles.searchBar}>
        <input
          className={styles.searchInput}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher dans l'historique..."
          spellCheck={false}
        />
      </div>
      {entries.length > 0 && (
        <div className={styles.searchBar} style={{ paddingTop: 0 }}>
          <button
            className={styles.clearBtn}
            onClick={async () => {
              await window.terranoAPI.history.clear()
              setEntries([])
            }}
          >
            <Trash2 size={14} />
            Effacer l'historique
          </button>
        </div>
      )}
      {entries.length === 0 ? (
        <div className={styles.emptyState}>
          <Clock size={32} />
          <span>Aucun historique</span>
        </div>
      ) : (
        entries.map((entry) => (
          <div
            key={entry.id}
            className={styles.item}
            onClick={() => handleClick(entry.url)}
          >
            <span className={styles.itemIcon}>
              {entry.faviconUrl ? (
                <img src={entry.faviconUrl} alt="" />
              ) : (
                <Globe size={16} />
              )}
            </span>
            <div className={styles.itemInfo}>
              <div className={styles.itemTitle}>{entry.title || entry.url}</div>
              <div className={styles.itemSubtitle}>
                {formatTime(entry.visitTime)} — {entry.url}
              </div>
            </div>
            <button
              className={styles.itemAction}
              onClick={(e) => {
                e.stopPropagation()
                handleDelete(entry.id)
              }}
              aria-label="Delete"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))
      )}
    </>
  )
}
