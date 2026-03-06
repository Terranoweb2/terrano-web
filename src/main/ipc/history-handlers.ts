import { ipcMain } from 'electron'
import { HistoryChannels } from '@shared/ipc-channels'
import type { HistoryStore } from '../storage/HistoryStore'

export function registerHistoryHandlers(historyStore: HistoryStore): void {
  ipcMain.handle(HistoryChannels.SEARCH, (_e, query: string) => {
    return historyStore.search(query)
  })

  ipcMain.handle(HistoryChannels.GET_RECENT, (_e, limit?: number) => {
    return historyStore.getRecent(limit)
  })

  ipcMain.handle(HistoryChannels.DELETE, (_e, id: number) => {
    historyStore.delete(id)
  })

  ipcMain.handle(HistoryChannels.CLEAR, () => {
    historyStore.clear()
  })
}
