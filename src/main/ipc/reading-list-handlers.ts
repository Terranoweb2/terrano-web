import { ipcMain } from 'electron'
import { ReadingListChannels } from '@shared/ipc-channels'
import type { ReadingListStore } from '../storage/ReadingListStore'

export function registerReadingListHandlers(store: ReadingListStore): void {
  ipcMain.handle(ReadingListChannels.GET_ALL, () => {
    return store.getAll()
  })

  ipcMain.handle(
    ReadingListChannels.ADD,
    (_e, data: { url: string; title: string; faviconUrl: string | null }) => {
      return store.add(data)
    }
  )

  ipcMain.handle(ReadingListChannels.MARK_READ, (_e, id: number) => {
    store.markRead(id)
  })

  ipcMain.handle(ReadingListChannels.DELETE, (_e, id: number) => {
    store.delete(id)
  })
}
