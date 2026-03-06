import { SMTPServer } from 'smtp-server'
import { simpleParser } from 'mailparser'
import type { EmailStore } from '../storage/EmailStore'
import type { EmailAccountService } from './EmailAccountService'

const EMAIL_DOMAIN = 'terranoweb.win'

interface SmtpServerCallbacks {
  onNewMessage?: (accountId: string) => void
}

export class SmtpLocalServer {
  private server: SMTPServer | null = null
  private port = 2525
  private store: EmailStore
  private accountService: EmailAccountService
  private callbacks: SmtpServerCallbacks

  constructor(store: EmailStore, accountService: EmailAccountService, callbacks: SmtpServerCallbacks = {}) {
    this.store = store
    this.accountService = accountService
    this.callbacks = callbacks
  }

  start(): void {
    this.server = new SMTPServer({
      authOptional: true,
      disabledCommands: ['STARTTLS'], // No TLS for local server
      onData: (stream, session, callback) => {
        this.handleIncomingMail(stream, session)
          .then(() => callback())
          .catch((err) => callback(new Error(`Mail processing error: ${err.message}`)))
      },
      onAuth: (auth, _session, callback) => {
        // Authenticate local accounts
        const account = this.accountService.verifyPassword(auth.username, auth.password)
        if (account) {
          callback(null, { user: account.id })
        } else {
          callback(new Error('Identifiants invalides'))
        }
      }
    })

    this.server.on('error', (err) => {
      console.error('[SMTP Server] Error:', err.message)
    })

    this.server.listen(this.port, '127.0.0.1', () => {
      console.log(`[SMTP Server] Listening on 127.0.0.1:${this.port}`)
    })
  }

  stop(): void {
    if (this.server) {
      this.server.close()
      this.server = null
    }
  }

  isRunning(): boolean {
    return this.server !== null
  }

  getPort(): number {
    return this.port
  }

  private async handleIncomingMail(stream: NodeJS.ReadableStream, _session: unknown): Promise<void> {
    const parsed = await simpleParser(stream)

    const toAddresses = this.extractAddresses(parsed.to)
    const ccAddresses = this.extractAddresses(parsed.cc)
    const fromAddress = parsed.from?.value?.[0]?.address ?? null
    const fromName = parsed.from?.value?.[0]?.name ?? null

    // Deliver to each local recipient
    const allRecipients = [...toAddresses, ...ccAddresses]
    for (const recipient of allRecipients) {
      if (!recipient.toLowerCase().endsWith(`@${EMAIL_DOMAIN}`)) continue

      const account = this.accountService.findAccountByEmail(recipient)
      if (!account) continue

      const inbox = this.store.getFolderBySpecialUse(account.id, 'inbox')
      if (!inbox) continue

      const bodyText = typeof parsed.text === 'string' ? parsed.text : null
      const bodyHtml = typeof parsed.html === 'string' ? parsed.html : null
      const snippet = bodyText ? bodyText.substring(0, 200).replace(/\s+/g, ' ').trim() : null
      const hasAttachments = (parsed.attachments?.length ?? 0) > 0

      const msgId = this.store.saveMessage({
        accountId: account.id,
        folderId: inbox.id,
        messageId: parsed.messageId ?? null,
        fromAddress,
        fromName,
        toAddresses,
        ccAddresses,
        subject: parsed.subject ?? '(sans sujet)',
        bodyText,
        bodyHtml,
        snippet,
        date: parsed.date?.getTime() ?? Date.now(),
        isRead: false,
        isFlagged: false,
        hasAttachments
      })

      // Save attachments
      if (parsed.attachments) {
        for (const att of parsed.attachments) {
          this.store.saveAttachment({
            messageId: msgId,
            filename: att.filename ?? 'attachment',
            contentType: att.contentType ?? 'application/octet-stream',
            size: att.size ?? 0,
            data: att.content
          })
        }
      }

      this.callbacks.onNewMessage?.(account.id)
    }
  }

  private extractAddresses(field: unknown): string[] {
    if (!field) return []
    if (typeof field === 'string') return [field]
    if (Array.isArray(field)) {
      return field.flatMap((item) => this.extractAddresses(item))
    }
    if (typeof field === 'object' && field !== null && 'value' in field) {
      const val = (field as { value: { address?: string }[] }).value
      if (Array.isArray(val)) {
        return val.map((v) => v.address ?? '').filter(Boolean)
      }
    }
    return []
  }
}
