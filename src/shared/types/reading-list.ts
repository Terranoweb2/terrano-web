export interface ReadingListItem {
  id: number
  url: string
  title: string
  faviconUrl: string | null
  addedAt: number
  isRead: boolean
}
