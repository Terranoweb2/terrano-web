import { ipcMain } from 'electron'
import { BookmarkChannels } from '@shared/ipc-channels'
import type { BookmarkStore } from '../storage/BookmarkStore'

export function registerBookmarkHandlers(bookmarkStore: BookmarkStore): void {
  ipcMain.handle(BookmarkChannels.GET_ALL, () => {
    return bookmarkStore.getAll()
  })

  ipcMain.handle(
    BookmarkChannels.CREATE,
    (_e, bookmark: { parentId?: number; title: string; url?: string; isFolder?: boolean }) => {
      return bookmarkStore.create(bookmark)
    }
  )

  ipcMain.handle(
    BookmarkChannels.UPDATE,
    (_e, id: number, data: Partial<{ title: string; url: string }>) => {
      bookmarkStore.update(id, data)
    }
  )

  ipcMain.handle(BookmarkChannels.DELETE, (_e, id: number) => {
    bookmarkStore.delete(id)
  })

  ipcMain.handle(BookmarkChannels.DELETE_BY_URL, (_e, url: string) => {
    bookmarkStore.deleteByUrl(url)
  })

  ipcMain.handle(BookmarkChannels.IS_BOOKMARKED, (_e, url: string) => {
    return bookmarkStore.isBookmarked(url)
  })
}
