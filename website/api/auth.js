const { randomUUID, scryptSync, randomBytes, timingSafeEqual } = require('crypto')
const { getDb } = require('../db')
const config = require('../config')
const { checkRateLimit } = require('../rateLimit')

const EMAIL_DOMAIN = 'terranoweb.win'
const USERNAME_REGEX = /^[a-z0-9._-]{3,30}$/

// --- Password hashing (FIX 10: Paramètres scrypt explicites) ---
const SCRYPT_OPTIONS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const key = scryptSync(password, salt, 64, SCRYPT_OPTIONS).toString('hex')
  return `${salt}:${key}`
}

function verifyPassword(password, hash) {
  const [salt, key] = hash.split(':')
  if (!salt || !key) return false
  const derived = scryptSync(password, salt, 64, SCRYPT_OPTIONS)
  return timingSafeEqual(derived, Buffer.from(key, 'hex'))
}

// --- Password policy ---
function validatePassword(password) {
  if (!password || password.length < config.PASSWORD_MIN_LENGTH) {
    return { valid: false, error: `Le mot de passe doit contenir au moins ${config.PASSWORD_MIN_LENGTH} caracteres` }
  }
  if (password.length > 128) {
    return { valid: false, error: 'Le mot de passe ne doit pas depasser 128 caracteres' }
  }
  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, error: 'Le mot de passe doit contenir au moins une lettre' }
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Le mot de passe doit contenir au moins un chiffre' }
  }
  return { valid: true }
}

// --- Email normalization helper ---
function normalizeForEmail(str) {
  return str
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
    .toLowerCase()
    .replace(/\s+/g, '')          // remove spaces
    .replace(/[^a-z0-9.-]/g, '')  // keep only alphanum, dots, hyphens
}

// --- Account lockout helpers ---
function recordLoginAttempt(username, ip, success) {
  const db = getDb()
  db.prepare(
    'INSERT INTO login_attempts (username, ip_address, success, attempted_at) VALUES (?, ?, ?, ?)'
  ).run(username, ip, success ? 1 : 0, Date.now())
}

function isAccountLocked(username) {
  const db = getDb()
  const windowStart = Date.now() - config.ACCOUNT_LOCKOUT_DURATION_MS
  const row = db.prepare(
    'SELECT COUNT(*) as cnt FROM login_attempts WHERE username = ? AND success = 0 AND attempted_at > ?'
  ).get(username, windowStart)
  return row.cnt >= config.ACCOUNT_LOCKOUT_THRESHOLD
}

// --- Session helpers (FIX 5: Limite à 5 sessions par utilisateur) ---
const MAX_SESSIONS_PER_USER = 5

function createSession(accountId) {
  const db = getDb()
  const token = randomBytes(32).toString('hex')
  const now = Date.now()

  // Supprimer les sessions les plus anciennes si la limite est atteinte
  db.prepare(`
    DELETE FROM web_sessions WHERE account_id = ? AND token NOT IN (
      SELECT token FROM web_sessions WHERE account_id = ?
      ORDER BY created_at DESC LIMIT ?
    )
  `).run(accountId, accountId, MAX_SESSIONS_PER_USER - 1)

  db.prepare(
    'INSERT INTO web_sessions (token, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
  ).run(token, accountId, now, now + config.SESSION_MAX_AGE_MS)
  return token
}

function getSessionUser(token) {
  if (!token) return null
  const db = getDb()
  const row = db.prepare(`
    SELECT a.id, a.username, a.email, a.display_name, a.created_at,
           a.first_name, a.last_name, a.birth_date, a.gender
    FROM web_sessions s
    JOIN web_accounts a ON a.id = s.account_id
    WHERE s.token = ? AND s.expires_at > ?
  `).get(token, Date.now())
  if (!row) return null
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    displayName: row.display_name,
    firstName: row.first_name,
    lastName: row.last_name,
    birthDate: row.birth_date,
    gender: row.gender,
    createdAt: row.created_at
  }
}

function deleteSession(token) {
  if (!token) return
  getDb().prepare('DELETE FROM web_sessions WHERE token = ?').run(token)
}

// --- Cookie helpers ---
function getSessionToken(req) {
  const cookie = req.headers.cookie || ''
  const match = cookie.match(/session=([^;]+)/)
  return match ? match[1] : null
}

function setSessionCookie(res, token) {
  const maxAge = Math.floor(config.SESSION_MAX_AGE_MS / 1000)
  // Secure flag only in production (behind Cloudflare HTTPS)
  const secure = process.env.NODE_ENV === 'production' ? ' Secure;' : ''
  res.setHeader('Set-Cookie', `session=${token}; HttpOnly;${secure} SameSite=Strict; Max-Age=${maxAge}; Path=/`)
}

function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === 'production' ? ' Secure;' : ''
  res.setHeader('Set-Cookie', `session=; HttpOnly;${secure} SameSite=Strict; Max-Age=0; Path=/`)
}

// --- Route handler ---
async function handleAuth(req, res, url, readBody) {
  const pathname = url.pathname
  const clientIp = req.clientIp || req.socket.remoteAddress || 'unknown'

  try {
    // ===================== OVERSIZED BODY CHECK =====================
    // Applied after readBody for POST routes

    // GET /api/auth/suggest-email?firstName=...&lastName=...
    if (pathname === '/api/auth/suggest-email' && req.method === 'GET') {
      const firstName = (url.searchParams.get('firstName') || '').trim().slice(0, config.MAX_NAME_LENGTH)
      const lastName = (url.searchParams.get('lastName') || '').trim().slice(0, config.MAX_NAME_LENGTH)

      if (!firstName || !lastName) {
        return sendJson(res, 400, { ok: false, error: 'Prenom et nom requis' })
      }

      const nFirst = normalizeForEmail(firstName)
      const nLast = normalizeForEmail(lastName)
      const db = getDb()
      const suggestions = []

      // Suggestion 1: prenom.nom
      let base1 = `${nFirst}.${nLast}`
      let email1 = `${base1}@${EMAIL_DOMAIN}`
      let suffix = 0
      while (db.prepare('SELECT id FROM web_accounts WHERE email = ?').get(email1)) {
        suffix++
        if (suffix > 99) break
        email1 = `${base1}${String(suffix).padStart(2, '0')}@${EMAIL_DOMAIN}`
      }
      suggestions.push(email1)

      // Suggestion 2: prenomnom + 2 digits
      let base2 = `${nFirst}${nLast}`
      let email2
      let attempts = 0
      do {
        const rand = String(Math.floor(Math.random() * 100)).padStart(2, '0')
        email2 = `${base2}${rand}@${EMAIL_DOMAIN}`
        attempts++
      } while (db.prepare('SELECT id FROM web_accounts WHERE email = ?').get(email2) && attempts < 20)
      suggestions.push(email2)

      return sendJson(res, 200, { ok: true, suggestions })
    }

    // GET /api/auth/check-email?email=...
    if (pathname === '/api/auth/check-email' && req.method === 'GET') {
      // Rate limit: 20 checks per minute per IP
      const rl = checkRateLimit('check-email', clientIp,
        config.RATE_LIMIT.CHECK_EMAIL_WINDOW_MS, config.RATE_LIMIT.CHECK_EMAIL_MAX)
      if (rl.limited) {
        console.log(`[Security] Check-email rate limit hit for IP ${clientIp}`)
        return sendJson(res, 429, { ok: false, error: 'Trop de verifications. Reessayez plus tard.' })
      }

      const localPart = (url.searchParams.get('email') || '').toLowerCase().trim()
      if (!localPart) return sendJson(res, 400, { ok: false })
      const db = getDb()
      const fullEmail = localPart.includes('@') ? localPart : `${localPart}@${EMAIL_DOMAIN}`
      const taken = !!db.prepare('SELECT id FROM web_accounts WHERE email = ? OR username = ?').get(fullEmail, localPart)
      // Anti-enumeration: only return available/not-available, no details
      return sendJson(res, 200, { ok: true, available: !taken })
    }

    // POST /api/auth/register
    if (pathname === '/api/auth/register' && req.method === 'POST') {
      // Rate limit: 5 registrations per hour per IP
      const rl = checkRateLimit('register', clientIp,
        config.RATE_LIMIT.REGISTER_WINDOW_MS, config.RATE_LIMIT.REGISTER_MAX)
      if (rl.limited) {
        console.log(`[Security] Registration rate limit hit for IP ${clientIp}`)
        return sendJson(res, 429, { ok: false, error: 'Trop de tentatives d\'inscription. Reessayez plus tard.' })
      }

      const body = await readBody(req)

      // Check oversized body or invalid content type
      if (body && body.__oversized) {
        return sendJson(res, 413, { ok: false, error: 'Requete trop volumineuse' })
      }
      if (body && body.__invalidContentType) {
        return sendJson(res, 415, { ok: false, error: 'Content-Type doit etre application/json' })
      }

      // New registration fields
      const firstName = (body.firstName || '').trim().slice(0, config.MAX_NAME_LENGTH)
      const lastName = (body.lastName || '').trim().slice(0, config.MAX_NAME_LENGTH)
      const birthDate = (body.birthDate || '').trim()
      const gender = (body.gender || '').trim()

      // Determine username and email
      let username = (body.username || '').toLowerCase().trim()
      let email = (body.email || '').trim().toLowerCase()

      // If email is provided (new flow), derive username from it
      if (email) {
        username = email.includes('@') ? email.split('@')[0] : email
        email = username + '@' + EMAIL_DOMAIN
      } else if (username) {
        email = `${username}@${EMAIL_DOMAIN}`
      }

      // Determine display name
      let displayName = (body.displayName || '').trim().slice(0, config.MAX_DISPLAY_NAME)
      if (!displayName && firstName && lastName) {
        displayName = `${firstName} ${lastName}`
      }
      if (!displayName) displayName = username

      const password = body.password || ''

      if (!USERNAME_REGEX.test(username)) {
        return sendJson(res, 400, { ok: false, error: 'Nom d\'utilisateur invalide (3-30 caracteres, lettres minuscules, chiffres, ., _, -)' })
      }

      // Enforce password policy
      const pwCheck = validatePassword(password)
      if (!pwCheck.valid) {
        return sendJson(res, 400, { ok: false, error: pwCheck.error })
      }

      const db = getDb()

      // Anti-enumeration: merge username/email checks into one generic message
      const existingUser = db.prepare('SELECT id FROM web_accounts WHERE username = ?').get(username)
      const existingEmail = db.prepare('SELECT id FROM web_accounts WHERE email = ?').get(email)
      if (existingUser || existingEmail) {
        return sendJson(res, 400, { ok: false, error: 'Ce nom d\'utilisateur ou cette adresse n\'est pas disponible' })
      }

      // Validate birth date format and semantics if provided
      if (birthDate) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
          return sendJson(res, 400, { ok: false, error: 'Format de date invalide' })
        }
        const parsedDate = new Date(birthDate + 'T00:00:00Z')
        if (isNaN(parsedDate.getTime())) {
          return sendJson(res, 400, { ok: false, error: 'Date de naissance invalide' })
        }
        if (parsedDate > new Date()) {
          return sendJson(res, 400, { ok: false, error: 'La date de naissance ne peut pas etre dans le futur' })
        }
        const minDate = new Date('1900-01-01T00:00:00Z')
        if (parsedDate < minDate) {
          return sendJson(res, 400, { ok: false, error: 'Date de naissance invalide' })
        }
      }

      // Validate gender if provided
      const validGenders = ['homme', 'femme', 'autre', 'non-specifie', '']
      if (gender && !validGenders.includes(gender)) {
        return sendJson(res, 400, { ok: false, error: 'Genre invalide' })
      }

      const id = randomUUID()
      const passwordHash = hashPassword(password)
      const createdAt = Date.now()

      // FIX 7: TOCTOU — try/catch pour gérer la race condition si UNIQUE constraint échoue
      try {
        db.prepare(`
          INSERT INTO web_accounts (id, username, email, display_name, password_hash, created_at, first_name, last_name, birth_date, gender)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, username, email, displayName, passwordHash, createdAt,
          firstName || null, lastName || null, birthDate || null, gender || null)
      } catch (insertErr) {
        if (insertErr.message && insertErr.message.includes('UNIQUE')) {
          return sendJson(res, 400, { ok: false, error: 'Ce nom d\'utilisateur ou cette adresse n\'est pas disponible' })
        }
        throw insertErr
      }

      console.log(`[Security] Registration success for "${username}" from IP ${clientIp}`)

      const token = createSession(id)
      setSessionCookie(res, token)

      return sendJson(res, 200, {
        ok: true,
        user: { id, username, email, displayName, firstName, lastName, createdAt }
      })
    }

    // POST /api/auth/login
    if (pathname === '/api/auth/login' && req.method === 'POST') {
      // Rate limit: 10 attempts per 15 min per IP
      const rl = checkRateLimit('login', clientIp,
        config.RATE_LIMIT.LOGIN_WINDOW_MS, config.RATE_LIMIT.LOGIN_MAX)
      if (rl.limited) {
        console.log(`[Security] Login rate limit hit for IP ${clientIp}`)
        return sendJson(res, 429, { ok: false, error: 'Trop de tentatives de connexion. Reessayez dans quelques minutes.' })
      }

      const body = await readBody(req)

      // Check oversized body or invalid content type
      if (body && body.__oversized) {
        return sendJson(res, 413, { ok: false, error: 'Requete trop volumineuse' })
      }
      if (body && body.__invalidContentType) {
        return sendJson(res, 415, { ok: false, error: 'Content-Type doit etre application/json' })
      }

      const input = (body.username || '').toLowerCase().trim()
      const password = body.password || ''

      if (!input || !password) {
        return sendJson(res, 400, { ok: false, error: 'Identifiants requis' })
      }

      // Accept username OR full email (user@terranoweb.win)
      let username = input
      if (input.includes('@')) {
        username = input.split('@')[0]
      }

      // Check account lockout BEFORE attempting password verification
      if (isAccountLocked(username)) {
        console.log(`[Security] Login blocked — account locked for "${username}" from IP ${clientIp}`)
        return sendJson(res, 423, { ok: false, error: 'Compte temporairement verrouille suite a trop de tentatives. Reessayez dans 15 minutes.' })
      }

      const db = getDb()
      const row = db.prepare('SELECT * FROM web_accounts WHERE username = ? OR email = ?').get(username, input)

      if (!row || !verifyPassword(password, row.password_hash)) {
        // Record failed attempt
        recordLoginAttempt(username, clientIp, false)
        console.log(`[Security] Login failure for "${username}" from IP ${clientIp}`)

        // Check if this failure triggers lockout
        if (isAccountLocked(username)) {
          console.log(`[Security] Account locked for "${username}" after threshold reached`)
        }

        return sendJson(res, 401, { ok: false, error: 'Identifiants invalides' })
      }

      // Record successful login
      recordLoginAttempt(row.username, clientIp, true)
      console.log(`[Security] Login success for "${row.username}" from IP ${clientIp}`)

      const token = createSession(row.id)
      setSessionCookie(res, token)

      return sendJson(res, 200, {
        ok: true,
        user: {
          id: row.id,
          username: row.username,
          email: row.email,
          displayName: row.display_name,
          createdAt: row.created_at
        }
      })
    }

    // POST /api/auth/logout
    if (pathname === '/api/auth/logout' && req.method === 'POST') {
      const token = getSessionToken(req)
      deleteSession(token)
      clearSessionCookie(res)
      return sendJson(res, 200, { ok: true })
    }

    // GET /api/auth/me
    if (pathname === '/api/auth/me' && req.method === 'GET') {
      const token = getSessionToken(req)
      const user = getSessionUser(token)
      if (!user) {
        return sendJson(res, 401, { ok: false })
      }
      return sendJson(res, 200, { ok: true, user })
    }

    sendJson(res, 404, { ok: false, error: 'Route non trouvee' })
  } catch (err) {
    console.error('[Auth] Error:', err.message)
    sendJson(res, 500, { ok: false, error: 'Erreur serveur interne' })
  }
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data))
}

// FIX 6: Nettoyage périodique des tables d'auth
function cleanupAuthTables() {
  try {
    const db = getDb()
    const now = Date.now()
    const attemptCutoff = now - 24 * 60 * 60 * 1000 // Supprimer les tentatives > 24h

    const sessionsDeleted = db.prepare('DELETE FROM web_sessions WHERE expires_at < ?').run(now)
    const attemptsDeleted = db.prepare('DELETE FROM login_attempts WHERE attempted_at < ?').run(attemptCutoff)

    if (sessionsDeleted.changes > 0 || attemptsDeleted.changes > 0) {
      console.log(`[Auth] Cleanup: ${sessionsDeleted.changes} sessions expirees, ${attemptsDeleted.changes} tentatives anciennes supprimees`)
    }
  } catch (err) {
    console.error('[Auth] Cleanup error:', err.message)
  }
}

module.exports = { handleAuth, getSessionToken, getSessionUser, cleanupAuthTables }
