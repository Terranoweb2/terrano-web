export interface TabState {
  id: string
  url: string
  title: string
  faviconUrl: string | null
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean
  isActive: boolean
  isPrivate: boolean
  isPinned: boolean
}

export interface CreateTabOptions {
  url?: string
  active?: boolean
  private?: boolean
}
