import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import type { AppSettings } from '@shared/types'
import { DEFAULT_SEARCH_ENGINE, NEW_TAB_URL } from '@shared/constants'

const defaults: AppSettings = {
  theme: 'system',
  searchEngine: DEFAULT_SEARCH_ENGINE,
  downloadPath: '',
  startupUrl: NEW_TAB_URL,
  restoreSession: false,
  adBlockerEnabled: true
}

export class SettingsManager {
  private filePath: string
  private data: AppSettings
  private onChange?: (settings: AppSettings) => void

  constructor() {
    const dataDir = path.join(app.getPath('userData'), 'data')
    fs.mkdirSync(dataDir, { recursive: true })
    this.filePath = path.join(dataDir, 'settings.json')
    this.data = this.load()

    // Set default download path if empty
    if (!this.data.downloadPath) {
      this.data.downloadPath = app.getPath('downloads')
    }

    // Migration: remplacer Google par TerranoWeb Search si l'utilisateur avait l'ancien défaut
    if (this.data.searchEngine === 'https://www.google.com/search?q=') {
      this.data.searchEngine = DEFAULT_SEARCH_ENGINE
    }

    this.save()
  }

  get(): AppSettings {
    return { ...this.data }
  }

  set(partial: Partial<AppSettings>): void {
    Object.assign(this.data, partial)
    this.save()
    this.onChange?.(this.get())
  }

  onChanged(callback: (settings: AppSettings) => void): void {
    this.onChange = callback
  }

  private load(): AppSettings {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8')
      return { ...defaults, ...JSON.parse(raw) }
    } catch {
      return { ...defaults }
    }
  }

  private save(): void {
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8')
  }
}
