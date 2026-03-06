import { ipcMain } from 'electron'
import { UpdateChannels } from '@shared/ipc-channels'
import type { AutoUpdateManager } from '../updater/AutoUpdateManager'

export function registerUpdateHandlers(updateManager: AutoUpdateManager): void {
  ipcMain.handle(UpdateChannels.GET_STATUS, () => {
    return updateManager.getStatus()
  })

  ipcMain.handle(UpdateChannels.CHECK, async () => {
    await updateManager.checkForUpdates()
  })

  ipcMain.handle(UpdateChannels.INSTALL, () => {
    updateManager.quitAndInstall()
  })
}
