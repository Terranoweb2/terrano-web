// ★ IPC Channel Contract — Single source of truth
// All IPC communication between main/preload/renderer goes through these channels.
// invoke = renderer calls main (request/response)
// send   = main pushes to renderer (one-way events)

import type { TabState, CreateTabOptions, NavigateOptions } from './types'

// --- Tab channels ---
export const TabChannels = {
  CREATE: 'tab:create',
  CLOSE: 'tab:close',
  ACTIVATE: 'tab:activate',
  GET_ALL: 'tab:get-all',
  PIN: 'tab:pin',
  UNPIN: 'tab:unpin',
  // Events (main → renderer)
  ON_CREATED: 'tab:on-created',
  ON_CLOSED: 'tab:on-closed',
  ON_ACTIVATED: 'tab:on-activated',
  ON_UPDATED: 'tab:on-updated'
} as const

// --- Navigation channels ---
export const NavChannels = {
  NAVIGATE: 'nav:navigate',
  GO_BACK: 'nav:go-back',
  GO_FORWARD: 'nav:go-forward',
  RELOAD: 'nav:reload',
  STOP: 'nav:stop',
  RESET_ZOOM: 'nav:reset-zoom',
  // Events (main → renderer)
  ON_STATE_CHANGED: 'nav:on-state-changed',
  ON_ZOOM_CHANGED: 'nav:on-zoom-changed'
} as const

// --- Window channels ---
export const WindowChannels = {
  MINIMIZE: 'window:minimize',
  MAXIMIZE: 'window:maximize',
  CLOSE: 'window:close',
  IS_MAXIMIZED: 'window:is-maximized',
  // Events
  ON_MAXIMIZE_CHANGED: 'window:on-maximize-changed'
} as const

// --- History channels ---
export const HistoryChannels = {
  SEARCH: 'history:search',
  GET_RECENT: 'history:get-recent',
  DELETE: 'history:delete',
  CLEAR: 'history:clear'
} as const

// --- Bookmark channels ---
export const BookmarkChannels = {
  GET_ALL: 'bookmark:get-all',
  CREATE: 'bookmark:create',
  UPDATE: 'bookmark:update',
  DELETE: 'bookmark:delete',
  DELETE_BY_URL: 'bookmark:delete-by-url',
  IS_BOOKMARKED: 'bookmark:is-bookmarked'
} as const

// --- Download channels ---
export const DownloadChannels = {
  GET_ALL: 'download:get-all',
  CANCEL: 'download:cancel',
  OPEN_FILE: 'download:open-file',
  SHOW_IN_FOLDER: 'download:show-in-folder',
  // Events
  ON_STARTED: 'download:on-started',
  ON_PROGRESS: 'download:on-progress',
  ON_COMPLETED: 'download:on-completed'
} as const

// --- Settings channels ---
export const SettingsChannels = {
  GET: 'settings:get',
  SET: 'settings:set',
  ON_CHANGED: 'settings:on-changed',
  PICK_DOWNLOAD_PATH: 'settings:pick-download-path'
} as const

// --- Permission channels ---
export const PermissionChannels = {
  RESPOND: 'permission:respond',
  ON_REQUEST: 'permission:on-request'
} as const

// --- Suggest channels ---
export const SuggestChannels = {
  QUERY: 'suggest:query'
} as const

// --- New Tab channels ---
export const NewTabChannels = {
  GET_CONFIG: 'newtab:get-config',
  GET_TOP_SITES: 'newtab:get-top-sites'
} as const

// --- Find channels ---
export const FindChannels = {
  FIND: 'find:find',
  STOP: 'find:stop',
  ON_RESULT: 'find:on-result'
} as const

// --- Ad Blocker channels ---
export const AdBlockChannels = {
  GET_STATE: 'adblock:get-state',
  SET_ENABLED: 'adblock:set-enabled',
  GET_BLOCKED_COUNT: 'adblock:get-blocked-count',
  ON_COUNT_UPDATED: 'adblock:on-count-updated'
} as const

// --- Reading List channels ---
export const ReadingListChannels = {
  GET_ALL: 'readinglist:get-all',
  ADD: 'readinglist:add',
  MARK_READ: 'readinglist:mark-read',
  DELETE: 'readinglist:delete'
} as const

// --- Sidebar channels ---
export const SidebarChannels = {
  SET_STATE: 'sidebar:set-state'
} as const

// --- Screenshot channels ---
export const ScreenshotChannels = {
  CAPTURE_VISIBLE: 'screenshot:capture-visible',
  CAPTURE_FULL_PAGE: 'screenshot:capture-full-page',
  CAPTURE_REGION: 'screenshot:capture-region',
  SAVE_TO_FILE: 'screenshot:save-to-file',
  COPY_TO_CLIPBOARD: 'screenshot:copy-to-clipboard',
  START_VIDEO: 'screenshot:start-video',
  STOP_VIDEO: 'screenshot:stop-video'
} as const

// --- Email channels ---
export const EmailChannels = {
  CREATE_ACCOUNT: 'email:create-account',
  GET_ACCOUNTS: 'email:get-accounts',
  DELETE_ACCOUNT: 'email:delete-account',
  LOGIN: 'email:login',
  GET_FOLDERS: 'email:get-folders',
  GET_MESSAGES: 'email:get-messages',
  GET_MESSAGE: 'email:get-message',
  SEND: 'email:send',
  MARK_READ: 'email:mark-read',
  MARK_FLAGGED: 'email:mark-flagged',
  DELETE_MESSAGE: 'email:delete-message',
  MOVE_MESSAGE: 'email:move-message',
  GET_SERVER_STATUS: 'email:get-server-status',
  GET_UNREAD_COUNT: 'email:get-unread-count',
  // Events
  ON_NEW_MESSAGE: 'email:on-new-message'
} as const

// --- Update channels ---
export const UpdateChannels = {
  CHECK: 'update:check',
  INSTALL: 'update:install',
  GET_STATUS: 'update:get-status',
  // Events (main → renderer)
  ON_STATUS_CHANGED: 'update:on-status-changed'
} as const

// Typed IPC contract for invoke handlers
export interface IpcInvokeHandlers {
  // Tabs
  [TabChannels.CREATE]: (opts?: CreateTabOptions) => TabState
  [TabChannels.CLOSE]: (tabId: string) => void
  [TabChannels.ACTIVATE]: (tabId: string) => void
  [TabChannels.GET_ALL]: () => TabState[]
  [TabChannels.PIN]: (tabId: string) => void
  [TabChannels.UNPIN]: (tabId: string) => void
  // Navigation
  [NavChannels.NAVIGATE]: (opts: NavigateOptions) => void
  [NavChannels.GO_BACK]: (tabId: string) => void
  [NavChannels.GO_FORWARD]: (tabId: string) => void
  [NavChannels.RELOAD]: (tabId: string) => void
  [NavChannels.STOP]: (tabId: string) => void
  // Window
  [WindowChannels.MINIMIZE]: () => void
  [WindowChannels.MAXIMIZE]: () => void
  [WindowChannels.CLOSE]: () => void
  [WindowChannels.IS_MAXIMIZED]: () => boolean
  // History
  [HistoryChannels.SEARCH]: (query: string) => import('./types').HistoryEntry[]
  [HistoryChannels.GET_RECENT]: (limit?: number) => import('./types').HistoryEntry[]
  [HistoryChannels.DELETE]: (id: number) => void
  [HistoryChannels.CLEAR]: () => void
  // Bookmarks
  [BookmarkChannels.GET_ALL]: () => import('./types').BookmarkNode[]
  [BookmarkChannels.CREATE]: (bookmark: {
    parentId?: number
    title: string
    url?: string
    isFolder?: boolean
  }) => import('./types').BookmarkNode
  [BookmarkChannels.UPDATE]: (id: number, data: Partial<{ title: string; url: string }>) => void
  [BookmarkChannels.DELETE]: (id: number) => void
  [BookmarkChannels.DELETE_BY_URL]: (url: string) => void
  [BookmarkChannels.IS_BOOKMARKED]: (url: string) => boolean
  // Downloads
  [DownloadChannels.GET_ALL]: () => import('./types').DownloadItem[]
  [DownloadChannels.CANCEL]: (id: string) => void
  [DownloadChannels.OPEN_FILE]: (id: string) => void
  [DownloadChannels.SHOW_IN_FOLDER]: (id: string) => void
  // Settings
  [SettingsChannels.GET]: () => import('./types').AppSettings
  [SettingsChannels.SET]: (partial: Partial<import('./types').AppSettings>) => void
  [SettingsChannels.PICK_DOWNLOAD_PATH]: () => string | null
  // Suggestions
  [SuggestChannels.QUERY]: (input: string) => { type: 'history' | 'bookmark'; title: string; url: string }[]
  // Permissions
  [PermissionChannels.RESPOND]: (requestId: string, granted: boolean) => void
  // Find
  [FindChannels.FIND]: (tabId: string, text: string, forward?: boolean) => void
  [FindChannels.STOP]: (tabId: string) => void
  // New Tab
  [NewTabChannels.GET_CONFIG]: () => { searchEngine: string; theme: string }
  [NewTabChannels.GET_TOP_SITES]: () => {
    url: string
    title: string
    faviconUrl: string | null
    visitCount: number
  }[]
  // Ad Blocker
  [AdBlockChannels.GET_STATE]: () => boolean
  [AdBlockChannels.SET_ENABLED]: (enabled: boolean) => void
  [AdBlockChannels.GET_BLOCKED_COUNT]: (tabId: string) => number
  // Reading List
  [ReadingListChannels.GET_ALL]: () => import('./types/reading-list').ReadingListItem[]
  [ReadingListChannels.ADD]: (data: { url: string; title: string; faviconUrl: string | null }) => import('./types/reading-list').ReadingListItem
  [ReadingListChannels.MARK_READ]: (id: number) => void
  [ReadingListChannels.DELETE]: (id: number) => void
  // Screenshot
  [ScreenshotChannels.CAPTURE_VISIBLE]: (tabId: string) => string
  [ScreenshotChannels.CAPTURE_FULL_PAGE]: (tabId: string) => string
  [ScreenshotChannels.CAPTURE_REGION]: (
    tabId: string,
    rect: import('./types').RegionRect
  ) => string
  [ScreenshotChannels.SAVE_TO_FILE]: (dataUrl: string) => string | null
  [ScreenshotChannels.COPY_TO_CLIPBOARD]: (dataUrl: string) => void
  [ScreenshotChannels.START_VIDEO]: (tabId: string) => string
  [ScreenshotChannels.STOP_VIDEO]: (videoData: Uint8Array) => string
  // Email
  [EmailChannels.CREATE_ACCOUNT]: (opts: import('./types').CreateAccountOptions) => import('./types').EmailAccount
  [EmailChannels.GET_ACCOUNTS]: () => import('./types').EmailAccount[]
  [EmailChannels.DELETE_ACCOUNT]: (accountId: string) => void
  [EmailChannels.LOGIN]: (username: string, password: string) => import('./types').EmailAccount | null
  [EmailChannels.GET_FOLDERS]: (accountId: string) => import('./types').EmailFolder[]
  [EmailChannels.GET_MESSAGES]: (accountId: string, folderId: number, limit?: number, offset?: number) => import('./types').EmailMessage[]
  [EmailChannels.GET_MESSAGE]: (messageId: number) => import('./types').EmailMessage | null
  [EmailChannels.SEND]: (email: import('./types').ComposeEmail) => void
  [EmailChannels.MARK_READ]: (messageId: number, read: boolean) => void
  [EmailChannels.MARK_FLAGGED]: (messageId: number, flagged: boolean) => void
  [EmailChannels.DELETE_MESSAGE]: (accountId: string, messageId: number) => void
  [EmailChannels.MOVE_MESSAGE]: (messageId: number, destFolderId: number) => void
  [EmailChannels.GET_SERVER_STATUS]: () => { running: boolean; port: number }
  [EmailChannels.GET_UNREAD_COUNT]: (accountId: string) => number
  // Update
  [UpdateChannels.CHECK]: () => void
  [UpdateChannels.INSTALL]: () => void
  [UpdateChannels.GET_STATUS]: () => import('./types').UpdateInfo
}
