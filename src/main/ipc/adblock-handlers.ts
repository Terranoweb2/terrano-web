import { ipcMain } from 'electron'
import { AdBlockChannels } from '@shared/ipc-channels'
import type { AdBlocker } from '../security/AdBlocker'
import type { SettingsManager } from '../settings/SettingsManager'

export function registerAdBlockHandlers(
  adBlocker: AdBlocker,
  settingsManager: SettingsManager
): void {
  ipcMain.handle(AdBlockChannels.GET_STATE, () => {
    return adBlocker.isEnabled()
  })

  ipcMain.handle(AdBlockChannels.SET_ENABLED, (_e, enabled: boolean) => {
    adBlocker.setEnabled(enabled)
    settingsManager.set({ adBlockerEnabled: enabled })
  })

  ipcMain.handle(AdBlockChannels.GET_BLOCKED_COUNT, (_e, tabId: string) => {
    return adBlocker.getBlockedCount(tabId)
  })
}
