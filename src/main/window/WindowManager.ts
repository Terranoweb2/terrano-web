import { app, BaseWindow, nativeImage } from 'electron'
import { join } from 'path'
import {
  DEFAULT_WINDOW_WIDTH,
  DEFAULT_WINDOW_HEIGHT,
  MIN_WINDOW_WIDTH,
  MIN_WINDOW_HEIGHT
} from '@shared/constants'
import { ViewManager } from './ViewManager'

function getResourcePath(filename: string): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, filename)
  }
  return join(app.getAppPath(), 'resources', filename)
}

export class WindowManager {
  private window: BaseWindow | null = null
  private viewManager: ViewManager | null = null

  createWindow(): { window: BaseWindow; viewManager: ViewManager } {
    // Charger l'icône TerranoWeb pour la fenêtre et la barre des tâches
    let appIcon: Electron.NativeImage | undefined
    try {
      appIcon = nativeImage.createFromPath(getResourcePath('favicon.png'))
      if (appIcon.isEmpty()) appIcon = undefined
    } catch {
      appIcon = undefined
    }

    this.window = new BaseWindow({
      width: DEFAULT_WINDOW_WIDTH,
      height: DEFAULT_WINDOW_HEIGHT,
      minWidth: MIN_WINDOW_WIDTH,
      minHeight: MIN_WINDOW_HEIGHT,
      show: true,
      frame: false,
      titleBarStyle: 'hidden',
      titleBarOverlay: false,
      ...(appIcon ? { icon: appIcon } : {})
    })

    this.viewManager = new ViewManager(this.window)

    this.window.on('closed', () => {
      this.viewManager?.destroy()
      this.window = null
      this.viewManager = null
    })

    return { window: this.window, viewManager: this.viewManager }
  }

  getWindow(): BaseWindow | null {
    return this.window
  }

  getViewManager(): ViewManager | null {
    return this.viewManager
  }
}
