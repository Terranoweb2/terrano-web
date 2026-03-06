export interface BookmarkNode {
  id: number
  parentId: number | null
  title: string
  url: string | null
  isFolder: boolean
  sortOrder: number
  children?: BookmarkNode[]
}
