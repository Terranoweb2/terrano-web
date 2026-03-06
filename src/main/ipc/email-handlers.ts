import { ipcMain } from 'electron'
import { EmailChannels } from '@shared/ipc-channels'
import type { CreateAccountOptions, ComposeEmail } from '@shared/types'
import type { EmailManager } from '../email/EmailManager'

export function registerEmailHandlers(emailManager: EmailManager): void {
  ipcMain.handle(EmailChannels.CREATE_ACCOUNT, (_e, opts: CreateAccountOptions) => {
    return emailManager.createAccount(opts)
  })

  ipcMain.handle(EmailChannels.GET_ACCOUNTS, () => {
    return emailManager.getAccounts()
  })

  ipcMain.handle(EmailChannels.DELETE_ACCOUNT, (_e, accountId: string) => {
    emailManager.deleteAccount(accountId)
  })

  ipcMain.handle(EmailChannels.LOGIN, (_e, username: string, password: string) => {
    return emailManager.login(username, password)
  })

  ipcMain.handle(EmailChannels.GET_FOLDERS, (_e, accountId: string) => {
    return emailManager.getFolders(accountId)
  })

  ipcMain.handle(EmailChannels.GET_MESSAGES, (_e, accountId: string, folderId: number, limit?: number, offset?: number) => {
    return emailManager.getMessages(accountId, folderId, limit, offset)
  })

  ipcMain.handle(EmailChannels.GET_MESSAGE, (_e, messageId: number) => {
    return emailManager.getMessage(messageId)
  })

  ipcMain.handle(EmailChannels.SEND, async (_e, email: ComposeEmail) => {
    await emailManager.send(email)
  })

  ipcMain.handle(EmailChannels.MARK_READ, (_e, messageId: number, read: boolean) => {
    emailManager.markRead(messageId, read)
  })

  ipcMain.handle(EmailChannels.MARK_FLAGGED, (_e, messageId: number, flagged: boolean) => {
    emailManager.markFlagged(messageId, flagged)
  })

  ipcMain.handle(EmailChannels.DELETE_MESSAGE, (_e, accountId: string, messageId: number) => {
    emailManager.deleteMessage(accountId, messageId)
  })

  ipcMain.handle(EmailChannels.MOVE_MESSAGE, (_e, messageId: number, destFolderId: number) => {
    emailManager.moveMessage(messageId, destFolderId)
  })

  ipcMain.handle(EmailChannels.GET_SERVER_STATUS, () => {
    return emailManager.getServerStatus()
  })

  ipcMain.handle(EmailChannels.GET_UNREAD_COUNT, (_e, accountId: string) => {
    return emailManager.getUnreadCount(accountId)
  })
}
