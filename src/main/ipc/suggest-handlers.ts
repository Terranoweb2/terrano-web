import { ipcMain } from 'electron'
import { SuggestChannels } from '@shared/ipc-channels'
import type { HistoryStore } from '../storage/HistoryStore'
import type { BookmarkStore } from '../storage/BookmarkStore'

interface Suggestion {
  type: 'history' | 'bookmark'
  title: string
  url: string
}

export function registerSuggestHandlers(historyStore: HistoryStore, bookmarkStore: BookmarkStore): void {
  ipcMain.handle(SuggestChannels.QUERY, (_e, input: string): Suggestion[] => {
    if (!input || input.length < 2) return []

    const suggestions: Suggestion[] = []
    const seen = new Set<string>()

    // Search bookmarks first (higher priority)
    const allBookmarks = bookmarkStore.getAll()
    function walkBookmarks(nodes: typeof allBookmarks) {
      for (const node of nodes) {
        if (node.url && !node.isFolder) {
          const lower = input.toLowerCase()
          if (node.title.toLowerCase().includes(lower) || node.url.toLowerCase().includes(lower)) {
            if (!seen.has(node.url)) {
              seen.add(node.url)
              suggestions.push({ type: 'bookmark', title: node.title, url: node.url })
            }
          }
        }
        if (node.children) walkBookmarks(node.children)
      }
    }
    walkBookmarks(allBookmarks)

    // Then search history
    const historyResults = historyStore.search(input)
    for (const entry of historyResults.slice(0, 8)) {
      if (!seen.has(entry.url)) {
        seen.add(entry.url)
        suggestions.push({ type: 'history', title: entry.title, url: entry.url })
      }
    }

    return suggestions.slice(0, 8)
  })
}
