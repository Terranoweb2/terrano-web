import { randomUUID, scryptSync, randomBytes, timingSafeEqual } from 'crypto'
import type { EmailAccount, CreateAccountOptions } from '@shared/types'
import type { EmailStore } from '../storage/EmailStore'

const EMAIL_DOMAIN = 'terranoweb.win'

export class EmailAccountService {
  constructor(private store: EmailStore) {}

  createAccount(opts: CreateAccountOptions): EmailAccount {
    const username = opts.username.toLowerCase().trim()

    // Validate username
    if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
      throw new Error('Nom d\'utilisateur invalide (3-30 caractères, lettres minuscules, chiffres, ., _, -)')
    }

    // Check uniqueness
    if (this.store.getAccountByUsername(username)) {
      throw new Error('Ce nom d\'utilisateur est déjà pris')
    }

    // Validate password
    if (opts.password.length < 6) {
      throw new Error('Le mot de passe doit contenir au moins 6 caractères')
    }

    const id = randomUUID()
    const emailAddress = `${username}@${EMAIL_DOMAIN}`
    const passwordHash = hashPassword(opts.password)
    const createdAt = Date.now()

    this.store.saveAccount({
      id,
      username,
      emailAddress,
      displayName: opts.displayName || username,
      passwordHash,
      createdAt
    })

    // Create default folders
    this.store.createDefaultFolders(id)

    return { id, username, emailAddress, displayName: opts.displayName || username, createdAt }
  }

  verifyPassword(username: string, password: string): EmailAccount | null {
    const raw = this.store.getAccountByUsername(username.toLowerCase().trim())
    if (!raw) return null

    if (!verifyPassword(password, raw.password_hash)) return null

    return {
      id: raw.id,
      username: raw.username,
      emailAddress: raw.email_address,
      displayName: raw.display_name,
      createdAt: raw.created_at
    }
  }

  getAccounts(): EmailAccount[] {
    return this.store.getAccounts()
  }

  deleteAccount(accountId: string): void {
    this.store.deleteAccount(accountId)
  }

  findAccountByEmail(email: string): EmailAccount | null {
    const raw = this.store.getAccountByEmail(email.toLowerCase())
    if (!raw) return null
    return {
      id: raw.id,
      username: raw.username,
      emailAddress: raw.email_address,
      displayName: raw.display_name,
      createdAt: raw.created_at
    }
  }
}

// Password hashing with scrypt
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const key = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${key}`
}

function verifyPassword(password: string, hash: string): boolean {
  const [salt, key] = hash.split(':')
  if (!salt || !key) return false
  const derivedKey = scryptSync(password, salt, 64)
  const keyBuffer = Buffer.from(key, 'hex')
  return timingSafeEqual(derivedKey, keyBuffer)
}
