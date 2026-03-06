import { ipcMain, app, clipboard, nativeImage, dialog, BrowserWindow, desktopCapturer } from 'electron'
import path from 'path'
import fs from 'fs'
import { ScreenshotChannels } from '@shared/ipc-channels'
import type { RegionRect } from '@shared/types'
import type { TabManager } from '../tabs/TabManager'
import { captureFullPage } from './screenshot-fullpage'

export function registerScreenshotHandlers(tabManager: TabManager): void {
  // ── Capture visible tab → base64 data URL ──
  ipcMain.handle(ScreenshotChannels.CAPTURE_VISIBLE, async (_e, tabId: string) => {
    const wc = tabManager.getTabWebContents(tabId)
    if (!wc) throw new Error('Tab not found')
    const image = await wc.capturePage()
    return image.toDataURL()
  })

  // ── Capture full page (scroll-stitch) → base64 data URL ──
  ipcMain.handle(ScreenshotChannels.CAPTURE_FULL_PAGE, async (_e, tabId: string) => {
    return await captureFullPage(tabManager, tabId)
  })

  // ── Capture region → crop from visible capture → base64 data URL ──
  ipcMain.handle(
    ScreenshotChannels.CAPTURE_REGION,
    async (_e, tabId: string, rect: RegionRect) => {
      const wc = tabManager.getTabWebContents(tabId)
      if (!wc) throw new Error('Tab not found')

      // capturePage supports a rect parameter for cropping
      const image = await wc.capturePage({
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      })
      return image.toDataURL()
    }
  )

  // ── Save data URL to file (show save dialog) ──
  ipcMain.handle(ScreenshotChannels.SAVE_TO_FILE, async (_e, dataUrl: string) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const defaultPath = path.join(
      app.getPath('downloads'),
      `capture-${timestamp}.png`
    )

    const { filePath, canceled } = await dialog.showSaveDialog({
      defaultPath,
      filters: [
        { name: 'Images PNG', extensions: ['png'] },
        { name: 'Images JPEG', extensions: ['jpg', 'jpeg'] },
        { name: 'Tous les fichiers', extensions: ['*'] }
      ]
    })

    if (canceled || !filePath) return null

    // Decode base64 data URL to buffer and write
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64, 'base64')
    fs.writeFileSync(filePath, buffer)

    return filePath
  })

  // ── Copy image to system clipboard ──
  ipcMain.handle(ScreenshotChannels.COPY_TO_CLIPBOARD, async (_e, dataUrl: string) => {
    const img = nativeImage.createFromDataURL(dataUrl)
    clipboard.writeImage(img)
  })

  // ── Video: start recording → return desktopCapturer source ID ──
  ipcMain.handle(ScreenshotChannels.START_VIDEO, async (_e, _tabId: string) => {
    // Try to get the focused BrowserWindow's media source ID
    const win = BrowserWindow.getFocusedWindow()
    if (win) {
      return win.getMediaSourceId()
    }
    // Fallback: use desktopCapturer to find the first window source
    const sources = await desktopCapturer.getSources({ types: ['window', 'screen'] })
    if (sources.length === 0) throw new Error('No capture source available')
    return sources[0].id
  })

  // ── Video: stop recording → save video data to file ──
  ipcMain.handle(ScreenshotChannels.STOP_VIDEO, async (_e, videoData: Uint8Array) => {
    if (!videoData || videoData.length === 0) return ''

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const defaultPath = path.join(
      app.getPath('videos') || app.getPath('downloads'),
      `recording-${timestamp}.webm`
    )

    const { filePath, canceled } = await dialog.showSaveDialog({
      defaultPath,
      filters: [
        { name: 'Video WebM', extensions: ['webm'] },
        { name: 'Tous les fichiers', extensions: ['*'] }
      ]
    })

    if (canceled || !filePath) return ''

    const buffer = Buffer.from(videoData)
    fs.writeFileSync(filePath, buffer)
    return filePath
  })
}
