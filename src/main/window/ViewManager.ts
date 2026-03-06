import { BaseWindow, WebContentsView } from 'electron'
import path from 'path'
import { getUIShellBounds, getTabViewBounds } from './BoundsCalculator'

export class ViewManager {
  private window: BaseWindow
  private uiShellView: WebContentsView
  private activeTabView: WebContentsView | null = null
  private sidebarWidth: number = 0

  constructor(window: BaseWindow) {
    this.window = window

    // Create UI shell view (React app) — ajouté EN PREMIER (en dessous)
    this.uiShellView = new WebContentsView({
      webPreferences: {
        preload: path.join(__dirname, '../preload/ui-preload.js'),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        webviewTag: false
      }
    })

    window.contentView.addChildView(this.uiShellView)
    this.updateBounds()

    // Listen for window resize
    window.on('resize', () => this.updateBounds())
  }

  get uiWebContents() {
    return this.uiShellView.webContents
  }

  loadUI(): void {
    if (!require('electron').app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
      this.uiShellView.webContents.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
      this.uiShellView.webContents.loadFile(
        path.join(__dirname, '../renderer/index.html')
      )
    }
  }

  showTabView(tabView: WebContentsView): void {
    // Remove previous active tab from content view (don't close it)
    if (this.activeTabView) {
      this.window.contentView.removeChildView(this.activeTabView)
    }

    this.activeTabView = tabView
    // Tab View ajouté AU-DESSUS du Shell — il couvre la zone de contenu web.
    // Le Shell (toolbar + sidebar) reste visible dans les zones non couvertes.
    this.window.contentView.addChildView(tabView)

    this.updateTabViewBounds()
  }

  hideActiveTabView(): void {
    if (this.activeTabView) {
      this.window.contentView.removeChildView(this.activeTabView)
      this.activeTabView = null
    }
  }

  /**
   * Appelé par le renderer via IPC quand le sidebar s'ouvre/ferme.
   * Réduit la largeur du TabView pour laisser le sidebar visible.
   */
  setSidebarWidth(width: number): void {
    this.sidebarWidth = width
    this.updateTabViewBounds()
  }

  private updateBounds(): void {
    const [width, height] = this.window.getContentSize()
    this.uiShellView.setBounds(getUIShellBounds(width, height))
    this.updateTabViewBounds()
  }

  private updateTabViewBounds(): void {
    if (!this.activeTabView) return
    const [width, height] = this.window.getContentSize()
    this.activeTabView.setBounds(getTabViewBounds(width, height, this.sidebarWidth))
  }

  destroy(): void {
    this.uiShellView.webContents.close()
  }
}
