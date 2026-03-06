import { create } from 'zustand'
import type { EmailAccount, EmailFolder, EmailMessage } from '@shared/types'

type EmailView = 'login' | 'create-account' | 'folders' | 'messages' | 'message' | 'compose'

interface EmailStore {
  // State
  accounts: EmailAccount[]
  activeAccount: EmailAccount | null
  folders: EmailFolder[]
  activeFolder: EmailFolder | null
  messages: EmailMessage[]
  activeMessage: EmailMessage | null
  view: EmailView
  unreadCount: number

  // Actions
  loadAccounts: () => Promise<void>
  setActiveAccount: (account: EmailAccount) => Promise<void>
  loadFolders: (accountId: string) => Promise<void>
  selectFolder: (folder: EmailFolder) => Promise<void>
  loadMessages: (accountId: string, folderId: number) => Promise<void>
  selectMessage: (message: EmailMessage) => Promise<void>
  refreshUnreadCount: () => Promise<void>
  setView: (view: EmailView) => void
  logout: () => void
  deleteMessage: (messageId: number) => Promise<void>
  toggleFlagged: (messageId: number, flagged: boolean) => Promise<void>
}

export const useEmailStore = create<EmailStore>((set, get) => ({
  accounts: [],
  activeAccount: null,
  folders: [],
  activeFolder: null,
  messages: [],
  activeMessage: null,
  view: 'login',
  unreadCount: 0,

  loadAccounts: async () => {
    const accounts = await window.terranoAPI.email.getAccounts()
    set({ accounts })
    if (accounts.length === 0) {
      set({ view: 'create-account' })
    }
  },

  setActiveAccount: async (account) => {
    set({ activeAccount: account, view: 'folders' })
    await get().loadFolders(account.id)
    await get().refreshUnreadCount()
  },

  loadFolders: async (accountId) => {
    const folders = await window.terranoAPI.email.getFolders(accountId)
    set({ folders })
    // Auto-select inbox
    const inbox = folders.find((f) => f.specialUse === 'inbox')
    if (inbox) {
      await get().selectFolder(inbox)
    }
  },

  selectFolder: async (folder) => {
    set({ activeFolder: folder, activeMessage: null, view: 'messages' })
    const account = get().activeAccount
    if (account) {
      await get().loadMessages(account.id, folder.id)
    }
  },

  loadMessages: async (accountId, folderId) => {
    const messages = await window.terranoAPI.email.getMessages(accountId, folderId)
    set({ messages })
  },

  selectMessage: async (message) => {
    set({ activeMessage: message, view: 'message' })
    if (!message.isRead) {
      await window.terranoAPI.email.markRead(message.id, true)
      set((s) => ({
        messages: s.messages.map((m) => (m.id === message.id ? { ...m, isRead: true } : m)),
        activeMessage: { ...message, isRead: true }
      }))
      await get().refreshUnreadCount()
    }
  },

  refreshUnreadCount: async () => {
    const account = get().activeAccount
    if (account) {
      const count = await window.terranoAPI.email.getUnreadCount(account.id)
      set({ unreadCount: count })
    }
  },

  setView: (view) => set({ view }),

  logout: () => {
    set({
      activeAccount: null,
      folders: [],
      activeFolder: null,
      messages: [],
      activeMessage: null,
      view: 'login',
      unreadCount: 0
    })
  },

  deleteMessage: async (messageId) => {
    const account = get().activeAccount
    if (!account) return
    await window.terranoAPI.email.deleteMessage(account.id, messageId)
    set((s) => ({
      messages: s.messages.filter((m) => m.id !== messageId),
      activeMessage: s.activeMessage?.id === messageId ? null : s.activeMessage,
      view: s.activeMessage?.id === messageId ? 'messages' : s.view
    }))
    await get().refreshUnreadCount()
  },

  toggleFlagged: async (messageId, flagged) => {
    await window.terranoAPI.email.markFlagged(messageId, flagged)
    set((s) => ({
      messages: s.messages.map((m) => (m.id === messageId ? { ...m, isFlagged: flagged } : m)),
      activeMessage: s.activeMessage?.id === messageId ? { ...s.activeMessage, isFlagged: flagged } : s.activeMessage
    }))
  }
}))
