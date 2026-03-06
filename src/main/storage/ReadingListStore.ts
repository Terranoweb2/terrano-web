import type { ReadingListItem } from '@shared/types/reading-list'
import { getDb } from './Database'

interface RawReadingListRow {
  id: number
  url: string
  title: string
  favicon_url: string | null
  added_at: number
  is_read: number
}

function toReadingListItem(row: RawReadingListRow): ReadingListItem {
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    faviconUrl: row.favicon_url,
    addedAt: row.added_at,
    isRead: row.is_read === 1
  }
}

export class ReadingListStore {
  getAll(): ReadingListItem[] {
    const db = getDb()
    const rows = db
      .prepare('SELECT id, url, title, favicon_url, added_at, is_read FROM reading_list ORDER BY added_at DESC')
      .all() as RawReadingListRow[]
    return rows.map(toReadingListItem)
  }

  add(data: { url: string; title: string; faviconUrl: string | null }): ReadingListItem {
    const db = getDb()
    const result = db
      .prepare('INSERT OR IGNORE INTO reading_list (url, title, favicon_url, added_at) VALUES (?, ?, ?, ?)')
      .run(data.url, data.title, data.faviconUrl, Date.now())

    if (result.changes === 0) {
      // Already exists, return existing
      const existing = db
        .prepare('SELECT id, url, title, favicon_url, added_at, is_read FROM reading_list WHERE url = ?')
        .get(data.url) as RawReadingListRow
      return toReadingListItem(existing)
    }

    return {
      id: result.lastInsertRowid as number,
      url: data.url,
      title: data.title,
      faviconUrl: data.faviconUrl,
      addedAt: Date.now(),
      isRead: false
    }
  }

  markRead(id: number): void {
    getDb().prepare('UPDATE reading_list SET is_read = 1 WHERE id = ?').run(id)
  }

  delete(id: number): void {
    getDb().prepare('DELETE FROM reading_list WHERE id = ?').run(id)
  }
}
