import { useState, useEffect, useRef } from 'react'
import { Search, ChevronUp, ChevronDown, X } from 'lucide-react'
import { useTabStore } from '@renderer/stores/tab-store'
import styles from './FindBar.module.css'

export function FindBar() {
  const [visible, setVisible] = useState(false)
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<{ active: number; total: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const activeTabId = useTabStore((s) => s.activeTabId)

  useEffect(() => {
    const cleanup = window.terranoAPI.onOpenFind(() => {
      setVisible(true)
      setTimeout(() => inputRef.current?.focus(), 50)
    })
    return cleanup
  }, [])

  useEffect(() => {
    const cleanup = window.terranoAPI.find.onResult((_tabId, res) => {
      const r = res as { activeMatchOrdinal: number; matches: number }
      setResult({ active: r.activeMatchOrdinal, total: r.matches })
    })
    return cleanup
  }, [])

  useEffect(() => {
    if (!visible || !query.trim() || !activeTabId) {
      setResult(null)
      return
    }
    const timer = setTimeout(() => {
      window.terranoAPI.find.find(activeTabId, query)
    }, 200)
    return () => clearTimeout(timer)
  }, [query, visible, activeTabId])

  function close() {
    setVisible(false)
    setQuery('')
    setResult(null)
    if (activeTabId) window.terranoAPI.find.stop(activeTabId)
  }

  function findNext() {
    if (activeTabId && query) window.terranoAPI.find.find(activeTabId, query, true)
  }

  function findPrev() {
    if (activeTabId && query) window.terranoAPI.find.find(activeTabId, query, false)
  }

  if (!visible) return null

  return (
    <div className={styles.findBar}>
      <Search size={14} className={styles.icon} />
      <input
        ref={inputRef}
        className={styles.input}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') findNext()
          if (e.key === 'Escape') close()
        }}
        placeholder="Rechercher dans la page..."
        spellCheck={false}
      />
      {result && (
        <span className={styles.count}>
          {result.total > 0 ? `${result.active}/${result.total}` : 'Aucun résultat'}
        </span>
      )}
      <button className={styles.btn} onClick={findPrev} aria-label="Previous">
        <ChevronUp size={16} />
      </button>
      <button className={styles.btn} onClick={findNext} aria-label="Next">
        <ChevronDown size={16} />
      </button>
      <button className={styles.btn} onClick={close} aria-label="Close">
        <X size={16} />
      </button>
    </div>
  )
}
