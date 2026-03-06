import type { EmailAccount, EmailFolder, EmailMessage, EmailAttachment } from '@shared/types'
import { getDb } from './Database'

interface RawAccount {
  id: string
  username: string
  email_address: string
  display_name: string
  password_hash: string
  created_at: number
}

interface RawFolder {
  id: number
  account_id: string
  name: string
  special_use: string | null
}

interface RawMessage {
  id: number
  account_id: string
  folder_id: number
  message_id: string | null
  from_address: string | null
  from_name: string | null
  to_addresses: string | null
  cc_addresses: string | null
  subject: string
  body_text: string | null
  body_html: string | null
  snippet: string | null
  date: number
  is_read: number
  is_flagged: number
  has_attachments: number
}

interface RawAttachment {
  id: number
  message_id: number
  filename: string
  content_type: string
  size: number
}

export class EmailStore {
  // --- Accounts ---
  saveAccount(account: { id: string; username: string; emailAddress: string; displayName: string; passwordHash: string; createdAt: number }): void {
    const db = getDb()
    db.prepare(
      `INSERT INTO email_accounts (id, username, email_address, display_name, password_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(account.id, account.username, account.emailAddress, account.displayName, account.passwordHash, account.createdAt)
  }

  getAccountRaw(id: string): RawAccount | undefined {
    return getDb().prepare('SELECT * FROM email_accounts WHERE id = ?').get(id) as RawAccount | undefined
  }

  getAccountByUsername(username: string): RawAccount | undefined {
    return getDb().prepare('SELECT * FROM email_accounts WHERE username = ?').get(username) as RawAccount | undefined
  }

  getAccountByEmail(email: string): RawAccount | undefined {
    return getDb().prepare('SELECT * FROM email_accounts WHERE email_address = ?').get(email) as RawAccount | undefined
  }

  getAccounts(): EmailAccount[] {
    const rows = getDb().prepare('SELECT * FROM email_accounts ORDER BY created_at').all() as RawAccount[]
    return rows.map(toEmailAccount)
  }

  deleteAccount(id: string): void {
    getDb().prepare('DELETE FROM email_accounts WHERE id = ?').run(id)
  }

  // --- Folders ---
  createDefaultFolders(accountId: string): void {
    const db = getDb()
    const insert = db.prepare(
      'INSERT INTO email_folders (account_id, name, special_use) VALUES (?, ?, ?)'
    )
    db.transaction(() => {
      insert.run(accountId, 'Boîte de réception', 'inbox')
      insert.run(accountId, 'Envoyés', 'sent')
      insert.run(accountId, 'Brouillons', 'drafts')
      insert.run(accountId, 'Corbeille', 'trash')
      insert.run(accountId, 'Spam', 'junk')
    })()
  }

  getFolders(accountId: string): EmailFolder[] {
    const rows = getDb()
      .prepare('SELECT * FROM email_folders WHERE account_id = ?')
      .all(accountId) as RawFolder[]
    return rows.map(toEmailFolder)
  }

  getFolderBySpecialUse(accountId: string, specialUse: string): EmailFolder | undefined {
    const row = getDb()
      .prepare('SELECT * FROM email_folders WHERE account_id = ? AND special_use = ?')
      .get(accountId, specialUse) as RawFolder | undefined
    return row ? toEmailFolder(row) : undefined
  }

  // --- Messages ---
  saveMessage(msg: {
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
  }): number {
    const db = getDb()
    const result = db.prepare(
      `INSERT INTO email_messages
       (account_id, folder_id, message_id, from_address, from_name, to_addresses, cc_addresses,
        subject, body_text, body_html, snippet, date, is_read, is_flagged, has_attachments)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      msg.accountId,
      msg.folderId,
      msg.messageId,
      msg.fromAddress,
      msg.fromName,
      JSON.stringify(msg.toAddresses),
      JSON.stringify(msg.ccAddresses),
      msg.subject,
      msg.bodyText,
      msg.bodyHtml,
      msg.snippet,
      msg.date,
      msg.isRead ? 1 : 0,
      msg.isFlagged ? 1 : 0,
      msg.hasAttachments ? 1 : 0
    )
    return Number(result.lastInsertRowid)
  }

  getMessages(folderId: number, limit = 50, offset = 0): EmailMessage[] {
    const rows = getDb()
      .prepare('SELECT * FROM email_messages WHERE folder_id = ? ORDER BY date DESC LIMIT ? OFFSET ?')
      .all(folderId, limit, offset) as RawMessage[]
    return rows.map(toEmailMessage)
  }

  getMessage(id: number): EmailMessage | null {
    const row = getDb().prepare('SELECT * FROM email_messages WHERE id = ?').get(id) as RawMessage | undefined
    return row ? toEmailMessage(row) : null
  }

  markRead(id: number, read: boolean): void {
    getDb().prepare('UPDATE email_messages SET is_read = ? WHERE id = ?').run(read ? 1 : 0, id)
  }

  markFlagged(id: number, flagged: boolean): void {
    getDb().prepare('UPDATE email_messages SET is_flagged = ? WHERE id = ?').run(flagged ? 1 : 0, id)
  }

  deleteMessage(id: number): void {
    getDb().prepare('DELETE FROM email_messages WHERE id = ?').run(id)
  }

  moveMessage(id: number, destFolderId: number): void {
    getDb().prepare('UPDATE email_messages SET folder_id = ? WHERE id = ?').run(destFolderId, id)
  }

  getUnreadCount(accountId: string): number {
    const row = getDb()
      .prepare(
        `SELECT COUNT(*) as cnt FROM email_messages m
         JOIN email_folders f ON f.id = m.folder_id
         WHERE m.account_id = ? AND f.special_use = 'inbox' AND m.is_read = 0`
      )
      .get(accountId) as { cnt: number }
    return row.cnt
  }

  // --- Attachments ---
  saveAttachment(att: { messageId: number; filename: string; contentType: string; size: number; data: Buffer }): number {
    const result = getDb().prepare(
      'INSERT INTO email_attachments (message_id, filename, content_type, size, data) VALUES (?, ?, ?, ?, ?)'
    ).run(att.messageId, att.filename, att.contentType, att.size, att.data)
    return Number(result.lastInsertRowid)
  }

  getAttachments(messageId: number): EmailAttachment[] {
    const rows = getDb()
      .prepare('SELECT id, message_id, filename, content_type, size FROM email_attachments WHERE message_id = ?')
      .all(messageId) as RawAttachment[]
    return rows.map((r) => ({
      id: r.id,
      messageId: r.message_id,
      filename: r.filename,
      contentType: r.content_type,
      size: r.size
    }))
  }

  getAttachmentData(id: number): Buffer | null {
    const row = getDb().prepare('SELECT data FROM email_attachments WHERE id = ?').get(id) as { data: Buffer } | undefined
    return row?.data ?? null
  }
}

function toEmailAccount(row: RawAccount): EmailAccount {
  return {
    id: row.id,
    username: row.username,
    emailAddress: row.email_address,
    displayName: row.display_name,
    createdAt: row.created_at
  }
}

function toEmailFolder(row: RawFolder): EmailFolder {
  return {
    id: row.id,
    accountId: row.account_id,
    name: row.name,
    specialUse: row.special_use as EmailFolder['specialUse']
  }
}

function toEmailMessage(row: RawMessage): EmailMessage {
  return {
    id: row.id,
    accountId: row.account_id,
    folderId: row.folder_id,
    messageId: row.message_id,
    fromAddress: row.from_address,
    fromName: row.from_name,
    toAddresses: parseJsonArray(row.to_addresses),
    ccAddresses: parseJsonArray(row.cc_addresses),
    subject: row.subject,
    bodyText: row.body_text,
    bodyHtml: row.body_html,
    snippet: row.snippet,
    date: row.date,
    isRead: row.is_read === 1,
    isFlagged: row.is_flagged === 1,
    hasAttachments: row.has_attachments === 1
  }
}

function parseJsonArray(json: string | null): string[] {
  if (!json) return []
  try {
    return JSON.parse(json)
  } catch {
    return []
  }
}
