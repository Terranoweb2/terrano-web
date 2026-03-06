import { app, ipcMain } from 'electron'

// Fix GPU cache errors on Windows — hardware acceleration disabled for stability
app.disableHardwareAcceleration()
app.commandLine.appendSwitch('disable-gpu-cache')
import {
  TabChannels,
  NavChannels,
  DownloadChannels,
  SettingsChannels,
  PermissionChannels,
  FindChannels,
  AdBlockChannels,
  EmailChannels,
  SidebarChannels,
  UpdateChannels
} from '@shared/ipc-channels'
import { NEW_TAB_URL } from '@shared/constants'
import { WindowManager } from './window/WindowManager'
import { TabManager } from './tabs/TabManager'
import { NavigationController } from './navigation/NavigationController'
import { initDatabase, closeDatabase } from './storage/Database'
import { HistoryStore } from './storage/HistoryStore'
import { BookmarkStore } from './storage/BookmarkStore'
import { DownloadStore } from './storage/DownloadStore'
import { DownloadManager } from './downloads/DownloadManager'
import { SettingsManager } from './settings/SettingsManager'
import { PermissionManager } from './security/PermissionManager'
import { AdBlocker } from './security/AdBlocker'
import { setupNavigationGuards } from './security/CspPolicy'
import { registerTabHandlers } from './ipc/tab-handlers'
import { registerNavHandlers } from './ipc/nav-handlers'
import { registerWindowHandlers, setupWindowEvents } from './ipc/window-handlers'
import { registerHistoryHandlers } from './ipc/history-handlers'
import { registerBookmarkHandlers } from './ipc/bookmark-handlers'
import { registerDownloadHandlers } from './ipc/download-handlers'
import { registerSettingsHandlers } from './ipc/settings-handlers'
import { registerFindHandlers } from './ipc/find-handlers'
import { registerSuggestHandlers } from './ipc/suggest-handlers'
import { registerNewTabHandlers } from './ipc/newtab-handlers'
import { registerAdBlockHandlers } from './ipc/adblock-handlers'
import { registerReadingListHandlers } from './ipc/reading-list-handlers'
import { registerScreenshotHandlers } from './ipc/screenshot-handlers'
import { registerEmailHandlers } from './ipc/email-handlers'
import { registerUpdateHandlers } from './ipc/update-handlers'
import { AutoUpdateManager } from './updater/AutoUpdateManager'
import { ReadingListStore } from './storage/ReadingListStore'
import { EmailStore } from './storage/EmailStore'
import { EmailManager } from './email/EmailManager'
import { SessionStore } from './session/SessionStore'
import { registerKeyboardShortcuts } from './menu/AppMenu'

// Single instance lock
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

const windowManager = new WindowManager()

function sendToUI(channel: string, ...args: unknown[]): void {
  const vm = windowManager.getViewManager()
  vm?.uiWebContents.send(channel, ...args)
}

app.whenReady().then(() => {
  // Initialize storage
  initDatabase()
  const historyStore = new HistoryStore()
  const bookmarkStore = new BookmarkStore()
  const downloadStore = new DownloadStore()
  const settingsManager = new SettingsManager()
  const sessionStore = new SessionStore()

  // Forward settings changes to UI
  settingsManager.onChanged((settings) => sendToUI(SettingsChannels.ON_CHANGED, settings))

  // Security: permission manager
  const permissionManager = new PermissionManager({
    onRequest: (requestId, origin, permission) =>
      sendToUI(PermissionChannels.ON_REQUEST, requestId, origin, permission)
  })
  permissionManager.setup()

  // Ad blocker
  const adBlocker = new AdBlocker()
  const initialSettings = settingsManager.get()
  adBlocker.setEnabled(initialSettings.adBlockerEnabled)

  const { window, viewManager } = windowManager.createWindow()

  // Tab manager with event forwarding to UI + history recording
  const tabManager = new TabManager(viewManager, {
    onCreated: (tab) => sendToUI(TabChannels.ON_CREATED, tab),
    onClosed: (tabId) => sendToUI(TabChannels.ON_CLOSED, tabId),
    onActivated: (tabId) => sendToUI(TabChannels.ON_ACTIVATED, tabId),
    onUpdated: (tab) => sendToUI(TabChannels.ON_UPDATED, tab),
    onNavigationStateChanged: (tabId, state) =>
      sendToUI(NavChannels.ON_STATE_CHANGED, tabId, state),
    onPageLoaded: (url, title, faviconUrl, isPrivate) => {
      if (!isPrivate && url && !url.startsWith('terrano://')) {
        historyStore.recordVisit(url, title, faviconUrl)
      }
    },
    onZoomChanged: (tabId, zoomLevel) =>
      sendToUI(NavChannels.ON_ZOOM_CHANGED, tabId, zoomLevel)
  })

  const navController = new NavigationController(tabManager, settingsManager)
  const readingListStore = new ReadingListStore()

  // Email
  const emailStore = new EmailStore()
  const emailManager = new EmailManager(emailStore, {
    onNewMessage: (accountId) => sendToUI(EmailChannels.ON_NEW_MESSAGE, accountId)
  })
  emailManager.start()

  // Auto-updater (Chrome-like background updates)
  const updateManager = new AutoUpdateManager({
    onStatusChanged: (info) => sendToUI(UpdateChannels.ON_STATUS_CHANGED, info)
  })
  updateManager.start()

  // Security: block dangerous protocols + ad blocker
  setupNavigationGuards(adBlocker, {
    onAdBlocked: (tabId, count) =>
      sendToUI(AdBlockChannels.ON_COUNT_UPDATED, tabId, count),
    getTabIdByWebContentsId: (wcId) => tabManager.getTabIdByWebContentsId(wcId)
  })

  // Download manager
  const downloadManager = new DownloadManager(downloadStore, {
    onStarted: (item) => sendToUI(DownloadChannels.ON_STARTED, item),
    onProgress: (item) => sendToUI(DownloadChannels.ON_PROGRESS, item),
    onCompleted: (item) => sendToUI(DownloadChannels.ON_COMPLETED, item)
  })
  downloadManager.setup()

  // Register all IPC handlers
  registerTabHandlers(tabManager)
  registerNavHandlers(navController)
  registerWindowHandlers(() => windowManager.getWindow())
  registerHistoryHandlers(historyStore)
  registerBookmarkHandlers(bookmarkStore)
  registerDownloadHandlers(downloadStore, downloadManager)
  registerSettingsHandlers(settingsManager)
  registerSuggestHandlers(historyStore, bookmarkStore)
  registerNewTabHandlers(settingsManager, historyStore)
  registerFindHandlers(tabManager, sendToUI)
  registerAdBlockHandlers(adBlocker, settingsManager)
  registerReadingListHandlers(readingListStore)
  registerScreenshotHandlers(tabManager)
  registerEmailHandlers(emailManager)
  registerUpdateHandlers(updateManager)

  // Sidebar IPC — resize tab view when sidebar opens/closes
  ipcMain.on(SidebarChannels.SET_STATE, (_e, { width }: { width: number }) => {
    viewManager.setSidebarWidth(width)
  })

  // Permission IPC
  ipcMain.handle(PermissionChannels.RESPOND, (_e, requestId: string, granted: boolean) => {
    permissionManager.respond(requestId, granted)
  })

  setupWindowEvents(window, sendToUI)

  // Keyboard shortcuts & application menu
  registerKeyboardShortcuts({
    window,
    tabManager,
    navController,
    viewManager
  })

  // Load UI shell
  viewManager.loadUI()

  // Restore session or create initial tab
  const settings = settingsManager.get()
  const sessionData = settings.restoreSession ? sessionStore.load() : null

  if (sessionData && sessionData.tabs.length > 0) {
    sessionData.tabs.forEach((tab, i) => {
      tabManager.createTab({
        url: tab.url,
        active: i === sessionData.activeTabIndex
      })
    })
    sessionStore.clear()
  } else {
    tabManager.createTab({ url: settings.startupUrl || NEW_TAB_URL, active: true })
  }

  // Clean up on close
  window.on('closed', () => {
    // Save session before destroying tabs
    const currentSettings = settingsManager.get()
    if (currentSettings.restoreSession) {
      const tabs = tabManager.getSessionTabs()
      const allTabs = tabManager.getAllTabs()
      const activeId = tabManager.getActiveTabId()
      const activeIndex = allTabs.findIndex((t) => t.id === activeId)
      sessionStore.save({ tabs, activeTabIndex: Math.max(0, activeIndex) })
    } else {
      sessionStore.clear()
    }
    updateManager.stop()
    emailManager.stop()
    tabManager.destroyAll()
    closeDatabase()
  })
})

app.on('window-all-closed', () => {
  app.quit()
})

// Focus existing window when second instance is launched
app.on('second-instance', () => {
  const win = windowManager.getWindow()
  if (win) {
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})
