import { useState, useEffect, useRef, type KeyboardEvent } from 'react'
import { Search, Globe, Clock, Bookmark } from 'lucide-react'
import { useTabStore } from '@renderer/stores/tab-store'
import { useNavStore } from '@renderer/stores/nav-store'
import styles from './Toolbar.module.css'

interface Suggestion {
  type: string
  title: string
  url: string
}

export function Omnibox() {
  const activeTabId = useTabStore((s) => s.activeTabId)
  const navState = useNavStore((s) => (activeTabId ? s.states[activeTabId] : null))
  const navigate = useNavStore((s) => s.navigate)

  const [value, setValue] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [selectedIdx, setSelectedIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync URL from active tab
  useEffect(() => {
    if (!isFocused && navState?.url) {
      const url = navState.url
      if (url.startsWith('terrano://') || url.includes('/resources/newtab.html') || url.includes('/resources/error.html')) {
        setValue('')
      } else {
        setValue(url)
      }
    }
  }, [navState?.url, isFocused])

  // Listen for Ctrl+L focus-omnibox from main process
  useEffect(() => {
    const handler = () => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
    return window.terranoAPI.onFocusOmnibox(handler)
  }, [])

  // Fetch suggestions as user types
  useEffect(() => {
    if (!isFocused || !value.trim() || value.trim().length < 2) {
      setSuggestions([])
      return
    }
    const timer = setTimeout(async () => {
      const results = await window.terranoAPI.suggest.query(value.trim())
      setSuggestions(results as Suggestion[])
      setSelectedIdx(-1)
    }, 150)
    return () => clearTimeout(timer)
  }, [value, isFocused])

  function submit(url?: string) {
    const target = url || value.trim()
    if (!activeTabId || !target) return
    navigate(activeTabId, target)
    inputRef.current?.blur()
    setSuggestions([])
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      if (selectedIdx >= 0 && suggestions[selectedIdx]) {
        submit(suggestions[selectedIdx].url)
      } else {
        submit()
      }
    } else if (e.key === 'Escape') {
      setSuggestions([])
      inputRef.current?.blur()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx((prev) => Math.min(prev + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx((prev) => Math.max(prev - 1, -1))
    }
  }

  function handleBlur() {
    // Delay to allow click on suggestion
    setTimeout(() => {
      setIsFocused(false)
      setSuggestions([])
    }, 150)
  }

  return (
    <div className={styles.omniboxWrapper}>
      <div className={`${styles.omnibox} ${isFocused ? styles.omniboxFocused : ''}`}>
        <Search size={14} className={styles.omniboxIcon} />
        <input
          ref={inputRef}
          className={styles.omniboxInput}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => {
            setIsFocused(true)
            inputRef.current?.select()
          }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder="Rechercher ou saisir une URL"
          spellCheck={false}
        />
      </div>
      {suggestions.length > 0 && isFocused && (
        <div className={styles.suggestions}>
          {suggestions.map((s, i) => (
            <div
              key={s.url}
              className={`${styles.suggestion} ${i === selectedIdx ? styles.suggestionActive : ''}`}
              onMouseDown={() => submit(s.url)}
            >
              <span className={styles.suggestionIcon}>
                {s.type === 'bookmark' ? <Bookmark size={14} /> : <Clock size={14} />}
              </span>
              <span className={styles.suggestionTitle}>{s.title}</span>
              <span className={styles.suggestionUrl}>{s.url}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
