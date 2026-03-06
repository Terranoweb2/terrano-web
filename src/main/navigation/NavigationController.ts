import type { NavigateOptions } from '@shared/types'
import { resolveInput } from '@shared/validators'
import { DEFAULT_SEARCH_ENGINE } from '@shared/constants'
import type { TabManager } from '../tabs/TabManager'
import type { SettingsManager } from '../settings/SettingsManager'

export class NavigationController {
  private tabManager: TabManager
  private settings?: SettingsManager

  constructor(tabManager: TabManager, settings?: SettingsManager) {
    this.tabManager = tabManager
    this.settings = settings
  }

  private getSearchEngine(): string {
    return this.settings?.get().searchEngine || DEFAULT_SEARCH_ENGINE
  }

  navigate(opts: NavigateOptions): void {
    const wc = this.tabManager.getTabWebContents(opts.tabId)
    if (!wc) return
    const url = resolveInput(opts.url, this.getSearchEngine())
    wc.loadURL(url)
  }

  goBack(tabId: string): void {
    const wc = this.tabManager.getTabWebContents(tabId)
    if (wc?.navigationHistory.canGoBack()) wc.navigationHistory.goBack()
  }

  goForward(tabId: string): void {
    const wc = this.tabManager.getTabWebContents(tabId)
    if (wc?.navigationHistory.canGoForward()) wc.navigationHistory.goForward()
  }

  reload(tabId: string): void {
    const wc = this.tabManager.getTabWebContents(tabId)
    wc?.reload()
  }

  stop(tabId: string): void {
    const wc = this.tabManager.getTabWebContents(tabId)
    wc?.stop()
  }

  resetZoom(tabId: string): void {
    const wc = this.tabManager.getTabWebContents(tabId)
    if (wc) {
      wc.setZoomLevel(0)
    }
  }
}
