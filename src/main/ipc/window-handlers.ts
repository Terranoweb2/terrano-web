import { ipcMain, BaseWindow } from 'electron'
import { WindowChannels } from '@shared/ipc-channels'

export function registerWindowHandlers(getWindow: () => BaseWindow | null): void {
  ipcMain.handle(WindowChannels.MINIMIZE, () => {
    getWindow()?.minimize()
  })

  ipcMain.handle(WindowChannels.MAXIMIZE, () => {
    const win = getWindow()
    if (!win) return
    if (win.isMaximized()) {
      win.unmaximize()
    } else {
      win.maximize()
    }
  })

  ipcMain.handle(WindowChannels.CLOSE, () => {
    getWindow()?.close()
  })

  ipcMain.handle(WindowChannels.IS_MAXIMIZED, () => {
    return getWindow()?.isMaximized() ?? false
  })
}

export function setupWindowEvents(
  window: BaseWindow,
  sendToUI: (channel: string, ...args: unknown[]) => void
): void {
  window.on('maximize', () => sendToUI(WindowChannels.ON_MAXIMIZE_CHANGED, true))
  window.on('unmaximize', () => sendToUI(WindowChannels.ON_MAXIMIZE_CHANGED, false))
}
