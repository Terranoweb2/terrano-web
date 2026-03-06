import { session, shell } from 'electron'
import { randomUUID } from 'crypto'
import type { DownloadItem as TDownloadItem } from '@shared/types'
import { DownloadStore } from '../storage/DownloadStore'

type DownloadCallback = {
  onStarted: (item: TDownloadItem) => void
  onProgress: (item: TDownloadItem) => void
  onCompleted: (item: TDownloadItem) => void
}

export class DownloadManager {
  private store: DownloadStore
  private callbacks: DownloadCallback
  private activeDownloads = new Map<string, Electron.DownloadItem>()
  private progressThrottles = new Map<string, number>()

  constructor(store: DownloadStore, callbacks: DownloadCallback) {
    this.store = store
    this.callbacks = callbacks
  }

  setup(): void {
    session.defaultSession.on('will-download', (_event, electronItem) => {
      const id = randomUUID()
      const filename = electronItem.getFilename()

      const item: TDownloadItem = {
        id,
        url: electronItem.getURL(),
        filename,
        savePath: electronItem.getSavePath() || '',
        totalBytes: electronItem.getTotalBytes(),
        receivedBytes: 0,
        state: 'progressing',
        startTime: Date.now()
      }

      this.activeDownloads.set(id, electronItem)

      electronItem.on('updated', (_e, state) => {
        item.receivedBytes = electronItem.getReceivedBytes()
        item.totalBytes = electronItem.getTotalBytes()
        item.savePath = electronItem.getSavePath()

        if (state === 'progressing') {
          item.state = 'progressing'

          // Throttle progress updates to 250ms
          const now = Date.now()
          const last = this.progressThrottles.get(id) ?? 0
          if (now - last >= 250) {
            this.progressThrottles.set(id, now)
            this.store.updateProgress(id, item.receivedBytes)
            this.callbacks.onProgress(item)
          }
        } else {
          item.state = 'interrupted'
          this.store.updateState(id, 'interrupted', item.receivedBytes)
        }
      })

      electronItem.once('done', (_e, state) => {
        this.activeDownloads.delete(id)
        this.progressThrottles.delete(id)

        item.receivedBytes = electronItem.getReceivedBytes()
        item.savePath = electronItem.getSavePath()

        if (state === 'completed') {
          item.state = 'completed'
          this.store.updateState(id, 'completed', item.receivedBytes)
        } else {
          item.state = 'cancelled'
          this.store.updateState(id, 'cancelled', item.receivedBytes)
        }

        this.callbacks.onCompleted(item)
      })

      // Notify UI immediately — savePath may be empty until user picks a location
      this.store.save(item)
      this.callbacks.onStarted(item)

      // When save path becomes available (after user picks location), update it
      const checkSavePath = (): void => {
        const sp = electronItem.getSavePath()
        if (sp && sp !== item.savePath) {
          item.savePath = sp
          this.store.updateProgress(id, item.receivedBytes)
        }
      }
      electronItem.on('updated', checkSavePath)
    })
  }

  cancel(id: string): void {
    const electronItem = this.activeDownloads.get(id)
    if (electronItem) {
      electronItem.cancel()
    }
  }

  openFile(id: string): void {
    const item = this.store.get(id)
    if (item?.savePath) {
      shell.openPath(item.savePath)
    }
  }

  showInFolder(id: string): void {
    const item = this.store.get(id)
    if (item?.savePath) {
      shell.showItemInFolder(item.savePath)
    }
  }
}
