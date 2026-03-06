import { ipcMain, dialog } from 'electron'
import { SettingsChannels } from '@shared/ipc-channels'
import type { AppSettings } from '@shared/types'
import type { SettingsManager } from '../settings/SettingsManager'

export function registerSettingsHandlers(settingsManager: SettingsManager): void {
  ipcMain.handle(SettingsChannels.GET, () => {
    return settingsManager.get()
  })

  ipcMain.handle(SettingsChannels.SET, (_e, partial: Partial<AppSettings>) => {
    settingsManager.set(partial)
  })

  ipcMain.handle(SettingsChannels.PICK_DOWNLOAD_PATH, async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })
}
