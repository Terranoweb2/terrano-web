import { ipcMain } from 'electron'
import { NavChannels } from '@shared/ipc-channels'
import type { NavigateOptions } from '@shared/types'
import type { NavigationController } from '../navigation/NavigationController'

export function registerNavHandlers(navController: NavigationController): void {
  ipcMain.handle(NavChannels.NAVIGATE, (_e, opts: NavigateOptions) => {
    navController.navigate(opts)
  })

  ipcMain.handle(NavChannels.GO_BACK, (_e, tabId: string) => {
    navController.goBack(tabId)
  })

  ipcMain.handle(NavChannels.GO_FORWARD, (_e, tabId: string) => {
    navController.goForward(tabId)
  })

  ipcMain.handle(NavChannels.RELOAD, (_e, tabId: string) => {
    navController.reload(tabId)
  })

  ipcMain.handle(NavChannels.STOP, (_e, tabId: string) => {
    navController.stop(tabId)
  })

  ipcMain.handle(NavChannels.RESET_ZOOM, (_e, tabId: string) => {
    navController.resetZoom(tabId)
  })
}
