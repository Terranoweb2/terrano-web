import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import type { SessionData } from '@shared/types'

export class SessionStore {
  private filePath: string

  constructor() {
    const dataDir = path.join(app.getPath('userData'), 'data')
    fs.mkdirSync(dataDir, { recursive: true })
    this.filePath = path.join(dataDir, 'session.json')
  }

  save(data: SessionData): void {
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8')
  }

  load(): SessionData | null {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8')
      const data = JSON.parse(raw) as SessionData
      if (data && Array.isArray(data.tabs) && data.tabs.length > 0) {
        return data
      }
      return null
    } catch {
      return null
    }
  }

  clear(): void {
    try {
      fs.unlinkSync(this.filePath)
    } catch {
      // File may not exist
    }
  }
}
