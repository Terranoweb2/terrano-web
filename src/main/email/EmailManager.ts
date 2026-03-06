import type {
  EmailAccount,
  CreateAccountOptions,
  EmailFolder,
  EmailMessage,
  ComposeEmail
} from '@shared/types'
import type { EmailStore } from '../storage/EmailStore'
import { EmailAccountService } from './EmailAccountService'
import { SmtpLocalServer } from './SmtpLocalServer'
import { SmtpOutbound } from './SmtpOutbound'

interface EmailManagerCallbacks {
  onNewMessage?: (accountId: string) => void
}

export class EmailManager {
  private accountService: EmailAccountService
  private smtpServer: SmtpLocalServer
  private smtpOutbound: SmtpOutbound
  private store: EmailStore
  private callbacks: EmailManagerCallbacks

  constructor(store: EmailStore, callbacks: EmailManagerCallbacks = {}) {
    this.store = store
    this.callbacks = callbacks
    this.accountService = new EmailAccountService(store)
    this.smtpOutbound = new SmtpOutbound(store)
    this.smtpServer = new SmtpLocalServer(store, this.accountService, {
      onNewMessage: (accountId) => this.callbacks.onNewMessage?.(accountId)
    })
  }

  start(): void {
    this.smtpServer.start()
  }

  stop(): void {
    this.smtpServer.stop()
  }

  getServerStatus(): { running: boolean; port: number } {
    return {
      running: this.smtpServer.isRunning(),
      port: this.smtpServer.getPort()
    }
  }

  // --- Accounts ---
  createAccount(opts: CreateAccountOptions): EmailAccount {
    return this.accountService.createAccount(opts)
  }

  login(username: string, password: string): EmailAccount | null {
    return this.accountService.verifyPassword(username, password)
  }

  getAccounts(): EmailAccount[] {
    return this.accountService.getAccounts()
  }

  deleteAccount(accountId: string): void {
    this.accountService.deleteAccount(accountId)
  }

  // --- Folders ---
  getFolders(accountId: string): EmailFolder[] {
    return this.store.getFolders(accountId)
  }

  // --- Messages ---
  getMessages(accountId: string, folderId: number, limit = 50, offset = 0): EmailMessage[] {
    return this.store.getMessages(folderId, limit, offset)
  }

  getMessage(messageId: number): EmailMessage | null {
    return this.store.getMessage(messageId)
  }

  markRead(messageId: number, read: boolean): void {
    this.store.markRead(messageId, read)
  }

  markFlagged(messageId: number, flagged: boolean): void {
    this.store.markFlagged(messageId, flagged)
  }

  deleteMessage(accountId: string, messageId: number): void {
    const msg = this.store.getMessage(messageId)
    if (!msg) return

    // Move to trash instead of deleting
    const trashFolder = this.store.getFolderBySpecialUse(accountId, 'trash')
    if (trashFolder && msg.folderId !== trashFolder.id) {
      this.store.moveMessage(messageId, trashFolder.id)
    } else {
      // Already in trash, permanently delete
      this.store.deleteMessage(messageId)
    }
  }

  moveMessage(messageId: number, destFolderId: number): void {
    this.store.moveMessage(messageId, destFolderId)
  }

  getUnreadCount(accountId: string): number {
    return this.store.getUnreadCount(accountId)
  }

  // --- Send ---
  async send(email: ComposeEmail): Promise<void> {
    await this.smtpOutbound.send(email)
  }
}
