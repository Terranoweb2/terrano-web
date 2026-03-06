import { session } from 'electron'
import { randomUUID } from 'crypto'
import { getDb } from '../storage/Database'

interface PendingRequest {
  resolve: (granted: boolean) => void
  origin: string
  permission: string
}

type PermissionCallback = {
  onRequest: (requestId: string, origin: string, permission: string) => void
}

export class PermissionManager {
  private pending = new Map<string, PendingRequest>()
  private callbacks: PermissionCallback

  constructor(callbacks: PermissionCallback) {
    this.callbacks = callbacks
  }

  setup(): void {
    session.defaultSession.setPermissionRequestHandler(
      (webContents, permission, callback, details) => {
        const url = details.requestingUrl || webContents.getURL()
        let origin: string
        try {
          origin = new URL(url).origin
        } catch {
          callback(false)
          return
        }

        // Auto-deny dangerous permissions
        const denied = ['openExternal']
        if (denied.includes(permission)) {
          callback(false)
          return
        }

        // Auto-allow safe permissions
        const allowed = ['clipboard-read', 'clipboard-sanitized-write']
        if (allowed.includes(permission)) {
          callback(true)
          return
        }

        // Check stored decision
        const stored = this.getStored(origin, permission)
        if (stored !== null) {
          callback(stored)
          return
        }

        // Ask user via UI prompt
        const requestId = randomUUID()
        this.pending.set(requestId, {
          resolve: (granted) => {
            this.storeDecision(origin, permission, granted)
            callback(granted)
          },
          origin,
          permission
        })

        this.callbacks.onRequest(requestId, origin, permission)
      }
    )
  }

  respond(requestId: string, granted: boolean): void {
    const req = this.pending.get(requestId)
    if (!req) return
    this.pending.delete(requestId)
    req.resolve(granted)
  }

  private getStored(origin: string, permission: string): boolean | null {
    try {
      const db = getDb()
      const row = db
        .prepare('SELECT granted FROM permissions WHERE origin = ? AND permission = ?')
        .get(origin, permission) as { granted: number } | undefined
      return row ? row.granted === 1 : null
    } catch {
      return null
    }
  }

  private storeDecision(origin: string, permission: string, granted: boolean): void {
    try {
      const db = getDb()
      db.prepare(
        'INSERT OR REPLACE INTO permissions (origin, permission, granted) VALUES (?, ?, ?)'
      ).run(origin, permission, granted ? 1 : 0)
    } catch {
      // Silently fail — non-critical
    }
  }
}
