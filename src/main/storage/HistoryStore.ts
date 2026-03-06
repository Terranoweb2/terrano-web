import type { HistoryEntry } from '@shared/types'
import { getDb } from './Database'

export class HistoryStore {
  recordVisit(url: string, title: string, faviconUrl: string | null): void {
    const db = getDb()
    const existing = db
      .prepare('SELECT id, visit_count FROM history WHERE url = ? ORDER BY visit_time DESC LIMIT 1')
      .get(url) as { id: number; visit_count: number } | undefined

    if (existing) {
      db.prepare('UPDATE history SET title = ?, favicon_url = ?, visit_time = ?, visit_count = ? WHERE id = ?')
        .run(title, faviconUrl, Date.now(), existing.visit_count + 1, existing.id)
    } else {
      db.prepare('INSERT INTO history (url, title, favicon_url, visit_time) VALUES (?, ?, ?, ?)')
        .run(url, title, faviconUrl, Date.now())
    }
  }

  search(query: string): HistoryEntry[] {
    const db = getDb()
    if (!query.trim()) return this.getRecent(50)

    const rows = db
      .prepare(
        `SELECT h.id, h.url, h.title, h.favicon_url, h.visit_time, h.visit_count
         FROM history h
         INNER JOIN history_fts ON history_fts.rowid = h.id
         WHERE history_fts MATCH ?
         ORDER BY h.visit_time DESC
         LIMIT 50`
      )
      .all(`${query}*`) as RawHistoryRow[]

    return rows.map(toHistoryEntry)
  }

  getRecent(limit = 100): HistoryEntry[] {
    const db = getDb()
    const rows = db
      .prepare(
        `SELECT id, url, title, favicon_url, visit_time, visit_count
         FROM history ORDER BY visit_time DESC LIMIT ?`
      )
      .all(limit) as RawHistoryRow[]

    return rows.map(toHistoryEntry)
  }

  delete(id: number): void {
    getDb().prepare('DELETE FROM history WHERE id = ?').run(id)
  }

  getTopSites(limit = 8): { url: string; title: string; faviconUrl: string | null; visitCount: number }[] {
    const db = getDb()
    const rows = db
      .prepare(
        `SELECT url, title, favicon_url, visit_count
         FROM history
         ORDER BY visit_count DESC, visit_time DESC
         LIMIT ?`
      )
      .all(limit) as RawHistoryRow[]

    return rows.map((row) => ({
      url: row.url,
      title: row.title,
      faviconUrl: row.favicon_url,
      visitCount: row.visit_count
    }))
  }

  clear(): void {
    const db = getDb()
    db.exec('DELETE FROM history')
  }
}

interface RawHistoryRow {
  id: number
  url: string
  title: string
  favicon_url: string | null
  visit_time: number
  visit_count: number
}

function toHistoryEntry(row: RawHistoryRow): HistoryEntry {
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    faviconUrl: row.favicon_url,
    visitTime: row.visit_time,
    visitCount: row.visit_count
  }
}
