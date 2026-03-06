import type { BookmarkNode } from '@shared/types'
import { getDb } from './Database'

export class BookmarkStore {
  getAll(): BookmarkNode[] {
    const db = getDb()
    const rows = db
      .prepare(
        `SELECT id, parent_id, title, url, is_folder, sort_order
         FROM bookmarks ORDER BY sort_order ASC`
      )
      .all() as RawBookmarkRow[]

    return buildTree(rows)
  }

  create(bookmark: {
    parentId?: number
    title: string
    url?: string
    isFolder?: boolean
  }): BookmarkNode {
    const db = getDb()
    const parentId = bookmark.parentId ?? 1 // Default to Bookmarks Bar

    // Get next sort_order
    const maxOrder = db
      .prepare('SELECT MAX(sort_order) as m FROM bookmarks WHERE parent_id = ?')
      .get(parentId) as { m: number | null }

    const sortOrder = (maxOrder.m ?? -1) + 1

    const result = db
      .prepare(
        'INSERT INTO bookmarks (parent_id, title, url, is_folder, sort_order) VALUES (?, ?, ?, ?, ?)'
      )
      .run(parentId, bookmark.title, bookmark.url ?? null, bookmark.isFolder ? 1 : 0, sortOrder)

    return {
      id: result.lastInsertRowid as number,
      parentId,
      title: bookmark.title,
      url: bookmark.url ?? null,
      isFolder: bookmark.isFolder ?? false,
      sortOrder
    }
  }

  update(id: number, data: Partial<{ title: string; url: string }>): void {
    const db = getDb()
    const fields: string[] = []
    const values: unknown[] = []

    if (data.title !== undefined) {
      fields.push('title = ?')
      values.push(data.title)
    }
    if (data.url !== undefined) {
      fields.push('url = ?')
      values.push(data.url)
    }

    if (fields.length === 0) return
    values.push(id)
    db.prepare(`UPDATE bookmarks SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  }

  delete(id: number): void {
    // Don't allow deleting root folders (id 1 and 2)
    if (id <= 2) return
    getDb().prepare('DELETE FROM bookmarks WHERE id = ?').run(id)
  }

  deleteByUrl(url: string): void {
    getDb().prepare('DELETE FROM bookmarks WHERE url = ? AND is_folder = 0').run(url)
  }

  isBookmarked(url: string): boolean {
    const db = getDb()
    const row = db
      .prepare('SELECT 1 FROM bookmarks WHERE url = ? AND is_folder = 0 LIMIT 1')
      .get(url) as unknown
    return row !== undefined
  }
}

interface RawBookmarkRow {
  id: number
  parent_id: number | null
  title: string
  url: string | null
  is_folder: number
  sort_order: number
}

function buildTree(rows: RawBookmarkRow[]): BookmarkNode[] {
  const nodeMap = new Map<number, BookmarkNode>()
  const roots: BookmarkNode[] = []

  // Create all nodes
  for (const row of rows) {
    nodeMap.set(row.id, {
      id: row.id,
      parentId: row.parent_id,
      title: row.title,
      url: row.url,
      isFolder: row.is_folder === 1,
      sortOrder: row.sort_order,
      children: row.is_folder === 1 ? [] : undefined
    })
  }

  // Build tree
  for (const node of nodeMap.values()) {
    if (node.parentId === null) {
      roots.push(node)
    } else {
      const parent = nodeMap.get(node.parentId)
      parent?.children?.push(node)
    }
  }

  return roots
}
