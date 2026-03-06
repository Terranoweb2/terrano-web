import { ipcMain } from 'electron'
import { FindChannels } from '@shared/ipc-channels'
import type { TabManager } from '../tabs/TabManager'

export function registerFindHandlers(
  tabManager: TabManager,
  sendToUI: (channel: string, ...args: unknown[]) => void
): void {
  ipcMain.handle(FindChannels.FIND, (_e, tabId: string, text: string, forward?: boolean) => {
    const wc = tabManager.getTabWebContents(tabId)
    if (!wc || !text) return
    // Remove previous listener to avoid duplicates
    wc.removeAllListeners('found-in-page')
    wc.on('found-in-page', (_event, result) => {
      sendToUI(FindChannels.ON_RESULT, tabId, {
        activeMatchOrdinal: result.activeMatchOrdinal,
        matches: result.matches
      })
    })
    wc.findInPage(text, { forward: forward ?? true })
  })

  ipcMain.handle(FindChannels.STOP, (_e, tabId: string) => {
    const wc = tabManager.getTabWebContents(tabId)
    wc?.stopFindInPage('clearSelection')
  })
}
