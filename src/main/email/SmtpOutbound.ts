import nodemailer from 'nodemailer'
import type { ComposeEmail } from '@shared/types'
import type { EmailStore } from '../storage/EmailStore'

const EMAIL_DOMAIN = 'terranoweb.win'

export class SmtpOutbound {
  private store: EmailStore

  constructor(store: EmailStore) {
    this.store = store
  }

  async send(email: ComposeEmail): Promise<void> {
    // Get the sender account
    const accounts = this.store.getAccounts()
    const account = accounts.find((a) => a.id === email.accountId)
    if (!account) throw new Error('Compte non trouvé')

    const isLocalDelivery = email.to.every((addr) =>
      addr.toLowerCase().endsWith(`@${EMAIL_DOMAIN}`)
    )

    if (isLocalDelivery) {
      // Direct local delivery: store the message in recipients' inbox
      await this.deliverLocally(email, account.emailAddress, account.displayName)
    } else {
      // Send via SMTP (direct delivery)
      await this.sendExternal(email, account.emailAddress, account.displayName)
    }

    // Save to "Sent" folder
    const sentFolder = this.store.getFolderBySpecialUse(email.accountId, 'sent')
    if (sentFolder) {
      this.store.saveMessage({
        accountId: email.accountId,
        folderId: sentFolder.id,
        messageId: null,
        fromAddress: account.emailAddress,
        fromName: account.displayName,
        toAddresses: email.to,
        ccAddresses: email.cc ?? [],
        subject: email.subject,
        bodyText: email.isHtml ? null : email.body,
        bodyHtml: email.isHtml ? email.body : null,
        snippet: email.body.substring(0, 200).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(),
        date: Date.now(),
        isRead: true,
        isFlagged: false,
        hasAttachments: false
      })
    }
  }

  private async deliverLocally(
    email: ComposeEmail,
    fromAddress: string,
    fromName: string
  ): Promise<void> {
    const { EmailAccountService } = await import('./EmailAccountService')

    for (const toAddr of email.to) {
      // Find the local account
      const raw = this.store.getAccountByEmail(toAddr.toLowerCase())
      if (!raw) continue

      const inbox = this.store.getFolderBySpecialUse(raw.id, 'inbox')
      if (!inbox) continue

      this.store.saveMessage({
        accountId: raw.id,
        folderId: inbox.id,
        messageId: null,
        fromAddress,
        fromName,
        toAddresses: email.to,
        ccAddresses: email.cc ?? [],
        subject: email.subject,
        bodyText: email.isHtml ? null : email.body,
        bodyHtml: email.isHtml ? email.body : null,
        snippet: email.body.substring(0, 200).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(),
        date: Date.now(),
        isRead: false,
        isFlagged: false,
        hasAttachments: false
      })
    }
  }

  private async sendExternal(
    email: ComposeEmail,
    fromAddress: string,
    fromName: string
  ): Promise<void> {
    // Use direct delivery (no relay server)
    const transporter = nodemailer.createTransport({
      direct: true,
      name: EMAIL_DOMAIN
    })

    await transporter.sendMail({
      from: `"${fromName}" <${fromAddress}>`,
      to: email.to.join(', '),
      cc: email.cc?.join(', '),
      bcc: email.bcc?.join(', '),
      subject: email.subject,
      [email.isHtml ? 'html' : 'text']: email.body
    })
  }
}
