import { ipcMain } from 'electron'
import { DownloadChannels } from '@shared/ipc-channels'
import type { DownloadStore } from '../storage/DownloadStore'
import type { DownloadManager } from '../downloads/DownloadManager'

export function registerDownloadHandlers(
  downloadStore: DownloadStore,
  downloadManager: DownloadManager
): void {
  ipcMain.handle(DownloadChannels.GET_ALL, () => {
    return downloadStore.getAll()
  })

  ipcMain.handle(DownloadChannels.CANCEL, (_e, id: string) => {
    downloadManager.cancel(id)
  })

  ipcMain.handle(DownloadChannels.OPEN_FILE, (_e, id: string) => {
    downloadManager.openFile(id)
  })

  ipcMain.handle(DownloadChannels.SHOW_IN_FOLDER, (_e, id: string) => {
    downloadManager.showInFolder(id)
  })
}
