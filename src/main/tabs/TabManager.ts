import { WebContentsView, session, app, Menu, clipboard } from 'electron'
import path from 'path'
import { randomUUID } from 'crypto'
import type { TabState, CreateTabOptions } from '@shared/types'
import { NEW_TAB_URL } from '@shared/constants'
import type { ViewManager } from '../window/ViewManager'

function getResourcePath(filename: string): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, filename)
  }
  return path.join(app.getAppPath(), 'resources', filename)
}

interface ManagedTab {
  id: string
  view: WebContentsView
  url: string
  title: string
  faviconUrl: string | null
  isLoading: boolean
  isPrivate: boolean
  isPinned: boolean
}

type TabEventCallback = {
  onCreated: (tab: TabState) => void
  onClosed: (tabId: string) => void
  onActivated: (tabId: string) => void
  onUpdated: (tab: TabState) => void
  onNavigationStateChanged: (
    tabId: string,
    state: { url: string; title: string; canGoBack: boolean; canGoForward: boolean; isLoading: boolean }
  ) => void
  onPageLoaded?: (url: string, title: string, faviconUrl: string | null, isPrivate: boolean) => void
  onZoomChanged?: (tabId: string, zoomLevel: number) => void
}

export class TabManager {
  private tabs = new Map<string, ManagedTab>()
  private activeTabId: string | null = null
  private closedTabUrls: string[] = []
  private viewManager: ViewManager
  private callbacks: TabEventCallback

  constructor(viewManager: ViewManager, callbacks: TabEventCallback) {
    this.viewManager = viewManager
    this.callbacks = callbacks
  }

  createTab(opts?: CreateTabOptions): TabState {
    const id = randomUUID()
    const url = opts?.url ?? NEW_TAB_URL
    const isPrivate = opts?.private ?? false

    const preloadFile = url === NEW_TAB_URL ? 'newtab-preload.js' : 'tab-preload.js'
    const webPreferences: Electron.WebPreferences = {
      preload: path.join(__dirname, `../preload/${preloadFile}`),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webviewTag: false
    }

    // Private tabs use ephemeral sessions
    if (isPrivate) {
      const partition = `private-${Date.now()}-${id}`
      webPreferences.session = session.fromPartition(partition, { cache: false })
    }

    const view = new WebContentsView({ webPreferences })

    const managedTab: ManagedTab = {
      id,
      view,
      url,
      title: 'New Tab',
      faviconUrl: null,
      isLoading: false,
      isPrivate,
      isPinned: false
    }

    this.tabs.set(id, managedTab)
    this.setupWebContentsListeners(managedTab)

    // Load the URL
    if (url === NEW_TAB_URL) {
      view.webContents.loadFile(getResourcePath('newtab.html'))
    } else {
      view.webContents.loadURL(url)
    }

    const shouldActivate = opts?.active !== false
    if (shouldActivate) {
      this.activateTab(id)
    }

    const tabState = this.toTabState(managedTab)
    this.callbacks.onCreated(tabState)
    return tabState
  }

  closeTab(tabId: string): void {
    const tab = this.tabs.get(tabId)
    if (!tab) return

    // If closing active tab, switch to adjacent tab
    if (this.activeTabId === tabId) {
      const tabIds = Array.from(this.tabs.keys())
      const idx = tabIds.indexOf(tabId)
      const nextId = tabIds[idx + 1] ?? tabIds[idx - 1]
      if (nextId) {
        this.activateTab(nextId)
      } else {
        this.viewManager.hideActiveTabView()
        this.activeTabId = null
      }
    }

    // Save URL for reopen
    this.closedTabUrls.push(tab.url)

    // Clean up
    this.viewManager.hideActiveTabView()
    tab.view.webContents.close()
    this.tabs.delete(tabId)
    this.callbacks.onClosed(tabId)

    // Re-show active tab if needed
    if (this.activeTabId) {
      const active = this.tabs.get(this.activeTabId)
      if (active) this.viewManager.showTabView(active.view)
    }
  }

  activateTab(tabId: string): void {
    const tab = this.tabs.get(tabId)
    if (!tab) return

    this.activeTabId = tabId
    this.viewManager.showTabView(tab.view)
    this.callbacks.onActivated(tabId)

    // Emit navigation state for the newly active tab
    this.emitNavigationState(tab)
  }

  getAllTabs(): TabState[] {
    return Array.from(this.tabs.values()).map((t) => this.toTabState(t))
  }

  getActiveTabId(): string | null {
    return this.activeTabId
  }

  getTabView(tabId: string): WebContentsView | undefined {
    return this.tabs.get(tabId)?.view
  }

  getTabWebContents(tabId: string) {
    return this.tabs.get(tabId)?.view.webContents
  }

  getSessionTabs(): { url: string; isPrivate: boolean }[] {
    return Array.from(this.tabs.values())
      .filter((t) => !t.isPrivate && t.url !== NEW_TAB_URL)
      .map((t) => ({ url: t.url, isPrivate: false }))
  }

  reopenClosedTab(): TabState | null {
    const url = this.closedTabUrls.pop()
    if (!url) return null
    return this.createTab({ url, active: true })
  }

  pinTab(tabId: string): void {
    const tab = this.tabs.get(tabId)
    if (!tab) return
    tab.isPinned = true
    this.callbacks.onUpdated(this.toTabState(tab))
  }

  unpinTab(tabId: string): void {
    const tab = this.tabs.get(tabId)
    if (!tab) return
    tab.isPinned = false
    this.callbacks.onUpdated(this.toTabState(tab))
  }

  getTabIdByWebContentsId(webContentsId: number): string | null {
    for (const [id, tab] of this.tabs.entries()) {
      if (tab.view.webContents.id === webContentsId) return id
    }
    return null
  }

  destroyAll(): void {
    for (const tab of this.tabs.values()) {
      tab.view.webContents.close()
    }
    this.tabs.clear()
    this.activeTabId = null
  }

  private setupWebContentsListeners(tab: ManagedTab): void {
    const wc = tab.view.webContents

    wc.on('did-start-loading', () => {
      tab.isLoading = true
      this.callbacks.onUpdated(this.toTabState(tab))
      this.emitNavigationState(tab)
    })

    wc.on('did-stop-loading', () => {
      tab.isLoading = false
      this.callbacks.onUpdated(this.toTabState(tab))
      this.emitNavigationState(tab)
      // Record visit in history
      this.callbacks.onPageLoaded?.(tab.url, tab.title, tab.faviconUrl, tab.isPrivate)
    })

    wc.on('did-navigate', (_e, url) => {
      tab.url = url
      this.callbacks.onUpdated(this.toTabState(tab))
      this.emitNavigationState(tab)
    })

    wc.on('did-navigate-in-page', (_e, url) => {
      tab.url = url
      this.callbacks.onUpdated(this.toTabState(tab))
      this.emitNavigationState(tab)
    })

    wc.on('page-title-updated', (_e, title) => {
      tab.title = title
      this.callbacks.onUpdated(this.toTabState(tab))
    })

    wc.on('page-favicon-updated', (_e, favicons) => {
      tab.faviconUrl = favicons[0] ?? null
      this.callbacks.onUpdated(this.toTabState(tab))
    })

    // Zoom changes
    wc.on('zoom-changed', () => {
      this.callbacks.onZoomChanged?.(tab.id, wc.getZoomLevel())
    })

    // Security: prevent new windows, redirect to tab
    wc.setWindowOpenHandler(({ url }) => {
      this.createTab({ url, active: true })
      return { action: 'deny' }
    })

    // Handle navigation errors — show error page
    wc.on('did-fail-load', (_e, errorCode, errorDescription, validatedURL) => {
      // Ignore aborted navigations (user navigated away before load finished)
      if (errorCode === -3) return
      wc.loadFile(getResourcePath('error.html'), {
        query: {
          code: String(errorCode),
          url: validatedURL,
          desc: errorDescription
        }
      })
    })

    // Context menu
    wc.on('context-menu', (_event, params) => {
      const menuItems: Electron.MenuItemConstructorOptions[] = []

      if (params.linkURL) {
        menuItems.push({
          label: 'Ouvrir dans un nouvel onglet',
          click: () => this.createTab({ url: params.linkURL, active: false })
        })
        menuItems.push({
          label: 'Copier l\'adresse du lien',
          click: () => clipboard.writeText(params.linkURL)
        })
        menuItems.push({ type: 'separator' })
      }

      if (params.selectionText) {
        menuItems.push({ label: 'Copier', role: 'copy' })
        menuItems.push({
          label: `Rechercher "${params.selectionText.substring(0, 30)}${params.selectionText.length > 30 ? '...' : ''}"`,
          click: () => {
            this.createTab({
              url: `https://terranoweb.win/search?q=${encodeURIComponent(params.selectionText)}`,
              active: true
            })
          }
        })
        menuItems.push({ type: 'separator' })
      }

      if (params.mediaType === 'image' && params.srcURL) {
        menuItems.push({
          label: 'Ouvrir l\'image dans un nouvel onglet',
          click: () => this.createTab({ url: params.srcURL, active: true })
        })
        menuItems.push({
          label: 'Copier l\'adresse de l\'image',
          click: () => clipboard.writeText(params.srcURL)
        })
        menuItems.push({ type: 'separator' })
      }

      if (params.isEditable) {
        menuItems.push({ label: 'Annuler', role: 'undo' })
        menuItems.push({ label: 'Rétablir', role: 'redo' })
        menuItems.push({ type: 'separator' })
        menuItems.push({ label: 'Couper', role: 'cut' })
        menuItems.push({ label: 'Copier', role: 'copy' })
        menuItems.push({ label: 'Coller', role: 'paste' })
        menuItems.push({ label: 'Tout sélectionner', role: 'selectAll' })
      } else if (!params.selectionText && !params.linkURL && params.mediaType === 'none') {
        menuItems.push({
          label: 'Précédent',
          click: () => wc.navigationHistory.goBack(),
          enabled: wc.navigationHistory.canGoBack()
        })
        menuItems.push({
          label: 'Suivant',
          click: () => wc.navigationHistory.goForward(),
          enabled: wc.navigationHistory.canGoForward()
        })
        menuItems.push({ label: 'Recharger', click: () => wc.reload() })
        menuItems.push({ type: 'separator' })
      }

      menuItems.push({ type: 'separator' })
      menuItems.push({
        label: 'Inspecter l\'élément',
        click: () => wc.inspectElement(params.x, params.y)
      })

      Menu.buildFromTemplate(menuItems).popup()
    })
  }

  private emitNavigationState(tab: ManagedTab): void {
    const wc = tab.view.webContents
    this.callbacks.onNavigationStateChanged(tab.id, {
      url: tab.url,
      title: tab.title,
      canGoBack: wc.navigationHistory.canGoBack(),
      canGoForward: wc.navigationHistory.canGoForward(),
      isLoading: tab.isLoading
    })
  }

  private toTabState(tab: ManagedTab): TabState {
    return {
      id: tab.id,
      url: tab.url,
      title: tab.title,
      faviconUrl: tab.faviconUrl,
      isLoading: tab.isLoading,
      canGoBack: tab.view.webContents.navigationHistory.canGoBack(),
      canGoForward: tab.view.webContents.navigationHistory.canGoForward(),
      isActive: tab.id === this.activeTabId,
      isPrivate: tab.isPrivate,
      isPinned: tab.isPinned
    }
  }
}
