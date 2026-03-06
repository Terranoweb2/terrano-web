import { app } from 'electron'
import { NsisUpdater } from 'electron-updater'
import type { UpdateInfo as ElectronUpdateInfo } from 'electron-updater'
import type { UpdateInfo, UpdateStatus } from '@shared/types'

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000 // 4 hours
const INITIAL_CHECK_DELAY_MS = 30 * 1000 // 30 seconds after startup

type StatusCallback = (info: UpdateInfo) => void

export class AutoUpdateManager {
  private updater: NsisUpdater | null = null
  private state: UpdateInfo
  private onStatusChanged?: StatusCallback
  private checkTimer: ReturnType<typeof setInterval> | null = null

  constructor(callbacks: { onStatusChanged: StatusCallback }) {
    this.onStatusChanged = callbacks.onStatusChanged

    this.state = {
      currentVersion: app.getVersion(),
      status: 'idle',
      availableVersion: null,
      releaseNotes: null,
      downloadProgress: 0,
      errorMessage: null
    }

    // Only create the updater in packaged builds
    if (app.isPackaged) {
      try {
        this.updater = new NsisUpdater({
          provider: 'generic',
          url: 'https://terranoweb.win/downloads'
        })

        // Chrome-like behavior: download automatically, install on quit
        this.updater.autoDownload = true
        this.updater.autoInstallOnAppQuit = true
        this.updater.autoRunAppAfterInstall = true
        // Allow downgrade in case of rollback
        this.updater.allowDowngrade = false

        this.setupEventHandlers()
      } catch (err) {
        console.error('[AutoUpdate] Failed to create updater:', (err as Error).message)
        this.updater = null
      }
    }
  }

  private setupEventHandlers(): void {
    if (!this.updater) return

    this.updater.on('checking-for-update', () => {
      this.updateState({ status: 'checking', errorMessage: null })
    })

    this.updater.on('update-available', (info: ElectronUpdateInfo) => {
      this.updateState({
        status: 'available',
        availableVersion: info.version,
        releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : null
      })
    })

    this.updater.on('update-not-available', () => {
      this.updateState({ status: 'not-available' })
    })

    this.updater.on('download-progress', (progress) => {
      this.updateState({
        status: 'downloading',
        downloadProgress: Math.round(progress.percent)
      })
    })

    this.updater.on('update-downloaded', () => {
      this.updateState({
        status: 'downloaded',
        downloadProgress: 100
      })
    })

    this.updater.on('error', (error: Error) => {
      console.error('[AutoUpdate] Error:', error.message)
      this.updateState({
        status: 'error',
        errorMessage: error.message
      })
    })
  }

  /** Start periodic checking. Call once after app.whenReady(). */
  start(): void {
    if (!this.updater) {
      console.log('[AutoUpdate] Skipping — updater not available (dev mode or init error)')
      // Still emit an initial state so the UI shows the version
      this.onStatusChanged?.({ ...this.state })
      return
    }

    // Initial check after a short delay (let the app finish loading)
    setTimeout(() => this.checkForUpdates(), INITIAL_CHECK_DELAY_MS)

    // Periodic checks every 4 hours
    this.checkTimer = setInterval(() => this.checkForUpdates(), CHECK_INTERVAL_MS)
  }

  /** Stop periodic checking. */
  stop(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer)
      this.checkTimer = null
    }
  }

  /** Manually trigger an update check. */
  async checkForUpdates(): Promise<void> {
    if (!this.updater) {
      this.updateState({
        status: 'error',
        errorMessage: 'Mise à jour non disponible en mode développement'
      })
      return
    }

    try {
      await this.updater.checkForUpdates()
    } catch (err) {
      const msg = (err as Error).message || 'Erreur inconnue'
      console.error('[AutoUpdate] Check failed:', msg)
      // Update the UI state so the user sees the error
      this.updateState({
        status: 'error',
        errorMessage: msg
      })
    }
  }

  /** Quit the app and install the downloaded update. */
  quitAndInstall(): void {
    if (this.updater) {
      this.updater.quitAndInstall(false, true)
    }
  }

  /** Get current snapshot of update state. */
  getStatus(): UpdateInfo {
    return { ...this.state }
  }

  private updateState(partial: Partial<UpdateInfo>): void {
    Object.assign(this.state, partial)
    this.onStatusChanged?.({ ...this.state })
  }
}
