export interface NavigationState {
  url: string
  title: string
  canGoBack: boolean
  canGoForward: boolean
  isLoading: boolean
}

export interface NavigateOptions {
  tabId: string
  url: string
}
