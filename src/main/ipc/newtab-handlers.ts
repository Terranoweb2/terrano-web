import { ipcMain } from 'electron'
import { NewTabChannels } from '@shared/ipc-channels'
import type { HistoryStore } from '../storage/HistoryStore'
import type { SettingsManager } from '../settings/SettingsManager'

export function registerNewTabHandlers(
  settingsManager: SettingsManager,
  historyStore: HistoryStore
): void {
  ipcMain.handle(NewTabChannels.GET_CONFIG, () => {
    const settings = settingsManager.get()
    return { searchEngine: settings.searchEngine, theme: settings.theme }
  })

  ipcMain.handle(NewTabChannels.GET_TOP_SITES, () => {
    return historyStore.getTopSites(8)
  })
}
