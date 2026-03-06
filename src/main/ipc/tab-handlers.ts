import { ipcMain } from 'electron'
import { TabChannels } from '@shared/ipc-channels'
import type { CreateTabOptions } from '@shared/types'
import type { TabManager } from '../tabs/TabManager'

export function registerTabHandlers(tabManager: TabManager): void {
  ipcMain.handle(TabChannels.CREATE, (_e, opts?: CreateTabOptions) => {
    return tabManager.createTab(opts)
  })

  ipcMain.handle(TabChannels.CLOSE, (_e, tabId: string) => {
    tabManager.closeTab(tabId)
  })

  ipcMain.handle(TabChannels.ACTIVATE, (_e, tabId: string) => {
    tabManager.activateTab(tabId)
  })

  ipcMain.handle(TabChannels.GET_ALL, () => {
    return tabManager.getAllTabs()
  })

  ipcMain.handle(TabChannels.PIN, (_e, tabId: string) => {
    tabManager.pinTab(tabId)
  })

  ipcMain.handle(TabChannels.UNPIN, (_e, tabId: string) => {
    tabManager.unpinTab(tabId)
  })
}
