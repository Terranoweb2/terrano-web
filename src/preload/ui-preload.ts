import { contextBridge, ipcRenderer } from 'electron'
import {
  TabChannels,
  NavChannels,
  WindowChannels,
  HistoryChannels,
  BookmarkChannels,
  DownloadChannels,
  SettingsChannels,
  PermissionChannels,
  FindChannels,
  SuggestChannels,
  AdBlockChannels,
  ReadingListChannels,
  SidebarChannels,
  ScreenshotChannels,
  EmailChannels,
  UpdateChannels
} from '@shared/ipc-channels'
import type {
  TabState,
  CreateTabOptions,
  NavigateOptions,
  NavigationState,
  HistoryEntry,
  BookmarkNode,
  DownloadItem,
  AppSettings,
  EmailAccount,
  CreateAccountOptions,
  EmailFolder,
  EmailMessage,
  ComposeEmail,
  UpdateInfo
} from '@shared/types'
import type { ReadingListItem } from '@shared/types/reading-list'

// Type-safe invoke helper
function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  return ipcRenderer.invoke(channel, ...args)
}

// Type-safe event listener helper
type Cleanup = () => void
function on(channel: string, callback: (...args: unknown[]) => void): Cleanup {
  const listener = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const terranoAPI = {
  // --- Tabs ---
  tabs: {
    create: (opts?: CreateTabOptions) => invoke<TabState>(TabChannels.CREATE, opts),
    close: (tabId: string) => invoke<void>(TabChannels.CLOSE, tabId),
    activate: (tabId: string) => invoke<void>(TabChannels.ACTIVATE, tabId),
    getAll: () => invoke<TabState[]>(TabChannels.GET_ALL),
    pin: (tabId: string) => invoke<void>(TabChannels.PIN, tabId),
    unpin: (tabId: string) => invoke<void>(TabChannels.UNPIN, tabId),
    onCreated: (cb: (tab: TabState) => void) => on(TabChannels.ON_CREATED, cb as never),
    onClosed: (cb: (tabId: string) => void) => on(TabChannels.ON_CLOSED, cb as never),
    onActivated: (cb: (tabId: string) => void) => on(TabChannels.ON_ACTIVATED, cb as never),
    onUpdated: (cb: (tab: TabState) => void) => on(TabChannels.ON_UPDATED, cb as never)
  },

  // --- Navigation ---
  nav: {
    navigate: (opts: NavigateOptions) => invoke<void>(NavChannels.NAVIGATE, opts),
    goBack: (tabId: string) => invoke<void>(NavChannels.GO_BACK, tabId),
    goForward: (tabId: string) => invoke<void>(NavChannels.GO_FORWARD, tabId),
    reload: (tabId: string) => invoke<void>(NavChannels.RELOAD, tabId),
    stop: (tabId: string) => invoke<void>(NavChannels.STOP, tabId),
    resetZoom: (tabId: string) => invoke<void>(NavChannels.RESET_ZOOM, tabId),
    onStateChanged: (cb: (tabId: string, state: NavigationState) => void) =>
      on(NavChannels.ON_STATE_CHANGED, cb as never),
    onZoomChanged: (cb: (tabId: string, zoomLevel: number) => void) =>
      on(NavChannels.ON_ZOOM_CHANGED, cb as never)
  },

  // --- Window controls ---
  window: {
    minimize: () => invoke<void>(WindowChannels.MINIMIZE),
    maximize: () => invoke<void>(WindowChannels.MAXIMIZE),
    close: () => invoke<void>(WindowChannels.CLOSE),
    isMaximized: () => invoke<boolean>(WindowChannels.IS_MAXIMIZED),
    onMaximizeChanged: (cb: (isMaximized: boolean) => void) =>
      on(WindowChannels.ON_MAXIMIZE_CHANGED, cb as never)
  },

  // --- History ---
  history: {
    search: (query: string) => invoke<HistoryEntry[]>(HistoryChannels.SEARCH, query),
    getRecent: (limit?: number) => invoke<HistoryEntry[]>(HistoryChannels.GET_RECENT, limit),
    delete: (id: number) => invoke<void>(HistoryChannels.DELETE, id),
    clear: () => invoke<void>(HistoryChannels.CLEAR)
  },

  // --- Bookmarks ---
  bookmarks: {
    getAll: () => invoke<BookmarkNode[]>(BookmarkChannels.GET_ALL),
    create: (bookmark: { parentId?: number; title: string; url?: string; isFolder?: boolean }) =>
      invoke<BookmarkNode>(BookmarkChannels.CREATE, bookmark),
    update: (id: number, data: Partial<{ title: string; url: string }>) =>
      invoke<void>(BookmarkChannels.UPDATE, id, data),
    delete: (id: number) => invoke<void>(BookmarkChannels.DELETE, id),
    deleteByUrl: (url: string) => invoke<void>(BookmarkChannels.DELETE_BY_URL, url),
    isBookmarked: (url: string) => invoke<boolean>(BookmarkChannels.IS_BOOKMARKED, url)
  },

  // --- Downloads ---
  downloads: {
    getAll: () => invoke<DownloadItem[]>(DownloadChannels.GET_ALL),
    cancel: (id: string) => invoke<void>(DownloadChannels.CANCEL, id),
    openFile: (id: string) => invoke<void>(DownloadChannels.OPEN_FILE, id),
    showInFolder: (id: string) => invoke<void>(DownloadChannels.SHOW_IN_FOLDER, id),
    onStarted: (cb: (item: DownloadItem) => void) =>
      on(DownloadChannels.ON_STARTED, cb as never),
    onProgress: (cb: (item: DownloadItem) => void) =>
      on(DownloadChannels.ON_PROGRESS, cb as never),
    onCompleted: (cb: (item: DownloadItem) => void) =>
      on(DownloadChannels.ON_COMPLETED, cb as never)
  },

  // --- Settings ---
  settings: {
    get: () => invoke<AppSettings>(SettingsChannels.GET),
    set: (partial: Partial<AppSettings>) => invoke<void>(SettingsChannels.SET, partial),
    pickDownloadPath: () => invoke<string | null>(SettingsChannels.PICK_DOWNLOAD_PATH),
    onChanged: (cb: (settings: AppSettings) => void) =>
      on(SettingsChannels.ON_CHANGED, cb as never)
  },

  // --- Suggestions ---
  suggest: {
    query: (input: string) => invoke<{ type: string; title: string; url: string }[]>(SuggestChannels.QUERY, input)
  },

  // --- Permissions ---
  permissions: {
    respond: (requestId: string, granted: boolean) =>
      invoke<void>(PermissionChannels.RESPOND, requestId, granted),
    onRequest: (cb: (requestId: string, origin: string, permission: string) => void) =>
      on(PermissionChannels.ON_REQUEST, cb as never)
  },

  // --- Find in page ---
  find: {
    find: (tabId: string, text: string, forward?: boolean) =>
      invoke<void>(FindChannels.FIND, tabId, text, forward),
    stop: (tabId: string) => invoke<void>(FindChannels.STOP, tabId),
    onResult: (
      cb: (tabId: string, result: { activeMatchOrdinal: number; matches: number }) => void
    ) => on(FindChannels.ON_RESULT, cb as never)
  },

  // --- Ad Blocker ---
  adblock: {
    getState: () => invoke<boolean>(AdBlockChannels.GET_STATE),
    setEnabled: (enabled: boolean) => invoke<void>(AdBlockChannels.SET_ENABLED, enabled),
    getBlockedCount: (tabId: string) => invoke<number>(AdBlockChannels.GET_BLOCKED_COUNT, tabId),
    onCountUpdated: (cb: (tabId: string, count: number) => void) =>
      on(AdBlockChannels.ON_COUNT_UPDATED, cb as never)
  },

  // --- Reading List ---
  readingList: {
    getAll: () => invoke<ReadingListItem[]>(ReadingListChannels.GET_ALL),
    add: (data: { url: string; title: string; faviconUrl: string | null }) =>
      invoke<ReadingListItem>(ReadingListChannels.ADD, data),
    markRead: (id: number) => invoke<void>(ReadingListChannels.MARK_READ, id),
    delete: (id: number) => invoke<void>(ReadingListChannels.DELETE, id)
  },

  // --- Sidebar ---
  sidebar: {
    setState: (width: number) => ipcRenderer.send(SidebarChannels.SET_STATE, { width })
  },

  // --- Screenshot ---
  screenshot: {
    captureVisible: (tabId: string) => invoke<string>(ScreenshotChannels.CAPTURE_VISIBLE, tabId),
    captureFullPage: (tabId: string) => invoke<string>(ScreenshotChannels.CAPTURE_FULL_PAGE, tabId),
    captureRegion: (tabId: string, rect: { x: number; y: number; width: number; height: number }) =>
      invoke<string>(ScreenshotChannels.CAPTURE_REGION, tabId, rect),
    saveToFile: (dataUrl: string) => invoke<string | null>(ScreenshotChannels.SAVE_TO_FILE, dataUrl),
    copyToClipboard: (dataUrl: string) => invoke<void>(ScreenshotChannels.COPY_TO_CLIPBOARD, dataUrl),
    startVideo: (tabId: string) => invoke<string>(ScreenshotChannels.START_VIDEO, tabId),
    stopVideo: (videoData: Uint8Array) => invoke<string>(ScreenshotChannels.STOP_VIDEO, videoData)
  },

  // --- Email ---
  email: {
    createAccount: (opts: CreateAccountOptions) => invoke<EmailAccount>(EmailChannels.CREATE_ACCOUNT, opts),
    getAccounts: () => invoke<EmailAccount[]>(EmailChannels.GET_ACCOUNTS),
    deleteAccount: (accountId: string) => invoke<void>(EmailChannels.DELETE_ACCOUNT, accountId),
    login: (username: string, password: string) => invoke<EmailAccount | null>(EmailChannels.LOGIN, username, password),
    getFolders: (accountId: string) => invoke<EmailFolder[]>(EmailChannels.GET_FOLDERS, accountId),
    getMessages: (accountId: string, folderId: number, limit?: number, offset?: number) =>
      invoke<EmailMessage[]>(EmailChannels.GET_MESSAGES, accountId, folderId, limit, offset),
    getMessage: (messageId: number) => invoke<EmailMessage | null>(EmailChannels.GET_MESSAGE, messageId),
    send: (email: ComposeEmail) => invoke<void>(EmailChannels.SEND, email),
    markRead: (messageId: number, read: boolean) => invoke<void>(EmailChannels.MARK_READ, messageId, read),
    markFlagged: (messageId: number, flagged: boolean) => invoke<void>(EmailChannels.MARK_FLAGGED, messageId, flagged),
    deleteMessage: (accountId: string, messageId: number) => invoke<void>(EmailChannels.DELETE_MESSAGE, accountId, messageId),
    moveMessage: (messageId: number, destFolderId: number) => invoke<void>(EmailChannels.MOVE_MESSAGE, messageId, destFolderId),
    getServerStatus: () => invoke<{ running: boolean; port: number }>(EmailChannels.GET_SERVER_STATUS),
    getUnreadCount: (accountId: string) => invoke<number>(EmailChannels.GET_UNREAD_COUNT, accountId),
    onNewMessage: (cb: (accountId: string) => void) => on(EmailChannels.ON_NEW_MESSAGE, cb as never)
  },

  // --- Update ---
  update: {
    getStatus: () => invoke<UpdateInfo>(UpdateChannels.GET_STATUS),
    check: () => invoke<void>(UpdateChannels.CHECK),
    install: () => invoke<void>(UpdateChannels.INSTALL),
    onStatusChanged: (cb: (info: UpdateInfo) => void) =>
      on(UpdateChannels.ON_STATUS_CHANGED, cb as never)
  },

  // --- UI commands (from menu shortcuts) ---
  onFocusOmnibox: (cb: () => void) => on('focus-omnibox', cb),
  onOpenFind: (cb: () => void) => on('open-find', cb),
  onCapturePage: (cb: () => void) => on('capture-page', cb)
}

contextBridge.exposeInMainWorld('terranoAPI', terranoAPI)

export type TerranoAPI = typeof terranoAPI
