export interface SessionTab {
  url: string
  isPrivate: boolean
}

export interface SessionData {
  tabs: SessionTab[]
  activeTabIndex: number
}
