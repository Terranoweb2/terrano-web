import { session } from 'electron'

export class SessionManager {
  private privateSessions = new Map<string, Electron.Session>()

  createPrivateSession(): { session: Electron.Session; partition: string } {
    const partition = `private-${Date.now()}`
    const sess = session.fromPartition(partition, { cache: false })

    // Apply same security settings as default session
    sess.setPermissionRequestHandler((_wc, _permission, callback) => {
      callback(false) // Deny all permissions in private mode
    })

    this.privateSessions.set(partition, sess)
    return { session: sess, partition }
  }

  destroyPrivateSession(partition: string): void {
    const sess = this.privateSessions.get(partition)
    if (sess) {
      sess.clearStorageData()
      sess.clearCache()
      this.privateSessions.delete(partition)
    }
  }

  destroyAll(): void {
    for (const [partition] of this.privateSessions) {
      this.destroyPrivateSession(partition)
    }
  }
}
