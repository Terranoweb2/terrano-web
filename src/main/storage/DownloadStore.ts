import type { DownloadItem } from '@shared/types'
import { getDb } from './Database'

export class DownloadStore {
  save(item: DownloadItem): void {
    const db = getDb()
    db.prepare(
      `INSERT OR REPLACE INTO downloads (id, url, filename, save_path, total_bytes, received_bytes, state, start_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      item.id,
      item.url,
      item.filename,
      item.savePath,
      item.totalBytes,
      item.receivedBytes,
      item.state,
      item.startTime
    )
  }

  updateProgress(id: string, receivedBytes: number): void {
    getDb()
      .prepare('UPDATE downloads SET received_bytes = ? WHERE id = ?')
      .run(receivedBytes, id)
  }

  updateState(id: string, state: string, receivedBytes?: number): void {
    const db = getDb()
    if (receivedBytes !== undefined) {
      db.prepare('UPDATE downloads SET state = ?, received_bytes = ? WHERE id = ?').run(
        state,
        receivedBytes,
        id
      )
    } else {
      db.prepare('UPDATE downloads SET state = ? WHERE id = ?').run(state, id)
    }
  }

  getAll(): DownloadItem[] {
    const db = getDb()
    const rows = db
      .prepare(
        `SELECT id, url, filename, save_path, total_bytes, received_bytes, state, start_time
         FROM downloads ORDER BY start_time DESC LIMIT 200`
      )
      .all() as RawDownloadRow[]

    return rows.map(toDownloadItem)
  }

  get(id: string): DownloadItem | undefined {
    const db = getDb()
    const row = db
      .prepare(
        'SELECT id, url, filename, save_path, total_bytes, received_bytes, state, start_time FROM downloads WHERE id = ?'
      )
      .get(id) as RawDownloadRow | undefined

    return row ? toDownloadItem(row) : undefined
  }
}

interface RawDownloadRow {
  id: string
  url: string
  filename: string
  save_path: string
  total_bytes: number
  received_bytes: number
  state: string
  start_time: number
}

function toDownloadItem(row: RawDownloadRow): DownloadItem {
  return {
    id: row.id,
    url: row.url,
    filename: row.filename,
    savePath: row.save_path,
    totalBytes: row.total_bytes,
    receivedBytes: row.received_bytes,
    state: row.state as DownloadItem['state'],
    startTime: row.start_time
  }
}
