export interface EmailAccount {
  id: string
  username: string
  emailAddress: string
  displayName: string
  createdAt: number
}

export interface CreateAccountOptions {
  username: string
  displayName: string
  password: string
}

export interface EmailFolder {
  id: number
  accountId: string
  name: string
  specialUse: 'inbox' | 'sent' | 'drafts' | 'trash' | 'junk' | null
}

export interface EmailMessage {
  id: number
  accountId: string
  folderId: number
  messageId: string | null
  fromAddress: string | null
  fromName: string | null
  toAddresses: string[]
  ccAddresses: string[]
  subject: string
  bodyText: string | null
  bodyHtml: string | null
  snippet: string | null
  date: number
  isRead: boolean
  isFlagged: boolean
  hasAttachments: boolean
}

export interface EmailAttachment {
  id: number
  messageId: number
  filename: string
  contentType: string
  size: number
}

export interface ComposeEmail {
  accountId: string
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  body: string
  isHtml: boolean
}

export type EmailSyncStatus = 'idle' | 'syncing' | 'error'
