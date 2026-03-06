const { randomUUID, timingSafeEqual } = require('crypto')
const { getDb } = require('../db')
const { getSessionToken, getSessionUser } = require('./auth')
const nodemailer = require('nodemailer')
const config = require('../config')
const { checkRateLimit } = require('../rateLimit')

// =====================================================================
// SMTP transport for external emails
// Via bore.pub tunnel -> smtp.terranomail.org (port 587 submission + STARTTLS)
// =====================================================================
const dns = require('dns')
dns.setDefaultResultOrder('ipv4first')

const smtpTransport = nodemailer.createTransport({
  host: config.SMTP_HOST,
  port: config.SMTP_PORT,
  secure: false,
  auth: { user: config.SMTP_USER, pass: config.SMTP_PASS },
  tls: {
    rejectUnauthorized: false,
    servername: 'smtp.terranomail.org'
  },
  name: 'terranoweb.win',
  connectionTimeout: 20000,
  greetingTimeout: 20000,
  socketTimeout: 30000
})

async function getSmtpTransport() {
  return smtpTransport
}

// =====================================================================
// Security helpers
// =====================================================================

// Escape HTML entities to prevent XSS in email templates
function escapeHtml(str) {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Sanitize display name for email headers (prevent header injection)
function sanitizeHeaderValue(str) {
  if (!str) return ''
  return str
    .replace(/[\r\n\t"\\]/g, '') // remove CR, LF, tab, quotes, backslashes
    .slice(0, 64)                 // limit length
}

// Blocked file extensions for attachments
const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.scr', '.vbs', '.js', '.ps1', '.msi',
  '.com', '.pif', '.wsf', '.wsh', '.cpl', '.hta', '.inf', '.reg'
])

// Allowed MIME type prefixes
const ALLOWED_MIME_PREFIXES = [
  'image/', 'text/', 'audio/', 'video/',
  'application/pdf', 'application/zip', 'application/x-zip',
  'application/gzip', 'application/x-gzip',
  'application/x-rar', 'application/x-7z',
  'application/msword', 'application/vnd.ms-', 'application/vnd.openxmlformats-',
  'application/vnd.oasis.opendocument',
  'application/json', 'application/xml',
  'application/octet-stream' // fallback for unknown types
]

function isAllowedMime(mimeType) {
  if (!mimeType) return false
  const lower = mimeType.toLowerCase()
  return ALLOWED_MIME_PREFIXES.some(prefix => lower.startsWith(prefix))
}

function isBlockedExtension(filename) {
  if (!filename) return true
  const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0] || ''
  return BLOCKED_EXTENSIONS.has(ext)
}

// =====================================================================
// Modern HTML Email Template (with HTML escaping)
// =====================================================================
function buildEmailHtml(senderName, senderEmail, subject, bodyText) {
  // Escape all user-provided content
  const safeName = escapeHtml(senderName)
  const safeEmail = escapeHtml(senderEmail)
  const safeSubject = escapeHtml(subject)
  const safeBody = escapeHtml(bodyText)

  // Convert plain text to HTML (paragraphs + line breaks)
  const bodyHtml = safeBody
    .split(/\n\n+/)
    .map(p => `<p style="margin:0 0 16px 0;line-height:1.7;color:#1e293b;font-size:15px">${p.replace(/\n/g, '<br>')}</p>`)
    .join('')

  // Safe first letter for avatar
  const firstLetter = safeName[0] ? safeName[0].toUpperCase() : 'T'

  return `<!DOCTYPE html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${safeSubject || 'Message TerranoWeb'}</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
  img{-ms-interpolation-mode:bicubic;border:0;height:auto;line-height:100%;outline:none;text-decoration:none}
  body{margin:0;padding:0;width:100%!important;background-color:#f1f5f9;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
  @media only screen and (max-width:620px){
    .email-container{width:100%!important;padding:8px!important}
    .email-card{border-radius:16px!important}
    .email-body{padding:24px 20px!important}
    .email-header{padding:28px 20px 24px!important}
    .email-footer{padding:20px!important}
  }
  @media (prefers-color-scheme:dark){
    body{background-color:#0f172a!important}
    .email-card{background-color:#1e293b!important;border-color:#334155!important}
    .email-body p,.email-body{color:#e2e8f0!important}
    .email-footer td{color:#94a3b8!important}
    .email-divider{border-color:#334155!important}
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">

<!-- Preview text -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">
  ${safeBody.substring(0, 120).replace(/\n/g, ' ')}
  ${'&#8204; &zwnj; &#160; '.repeat(30)}
</div>

<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f1f5f9">
<tr><td align="center" style="padding:24px 16px">

  <!-- Main container -->
  <table role="presentation" cellpadding="0" cellspacing="0" class="email-container" style="width:580px;max-width:580px">

    <!-- Logo bar -->
    <tr><td align="center" style="padding:0 0 20px">
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding-right:10px" valign="middle">
            <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#10b981,#059669);text-align:center;line-height:32px">
              <span style="color:#fff;font-size:16px;font-weight:700">T</span>
            </div>
          </td>
          <td valign="middle">
            <span style="font-size:16px;font-weight:700;color:#0f172a;letter-spacing:-0.3px">TerranoWeb</span>
            <span style="font-size:12px;color:#94a3b8;margin-left:4px">Mail</span>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- Email card -->
    <tr><td>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" class="email-card"
        style="background:#ffffff;border-radius:20px;border:1px solid #e2e8f0;box-shadow:0 4px 24px rgba(0,0,0,0.06)">

        <!-- Header gradient -->
        <tr><td class="email-header"
          style="padding:32px 32px 28px;background:linear-gradient(135deg,#10b981 0%,#059669 50%,#0d9488 100%);border-radius:20px 20px 0 0">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td>
                <div style="width:48px;height:48px;border-radius:12px;background:rgba(255,255,255,0.2);text-align:center;line-height:48px;margin-bottom:16px">
                  <span style="color:#fff;font-size:22px;font-weight:700">${firstLetter}</span>
                </div>
                <div style="font-size:18px;font-weight:700;color:#fff;margin-bottom:4px">${safeName}</div>
                <div style="font-size:13px;color:rgba(255,255,255,0.8)">${safeEmail}</div>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Body -->
        <tr><td class="email-body" style="padding:32px 32px 28px">
          ${bodyHtml}
        </td></tr>

        <!-- Divider -->
        <tr><td style="padding:0 32px">
          <div class="email-divider" style="border-top:1px solid #e2e8f0"></div>
        </td></tr>

        <!-- Reply hint -->
        <tr><td style="padding:20px 32px 28px">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="background:#f0fdf4;border-radius:12px;padding:16px 20px;border:1px solid #bbf7d0">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-right:12px" valign="top">
                      <div style="width:28px;height:28px;border-radius:8px;background:#10b981;text-align:center;line-height:28px">
                        <span style="color:#fff;font-size:14px">&#8617;</span>
                      </div>
                    </td>
                    <td valign="middle">
                      <div style="font-size:13px;font-weight:600;color:#065f46;margin-bottom:2px">Repondre a ce message</div>
                      <div style="font-size:12px;color:#047857">Repondez directement a cet email pour contacter ${safeName}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td></tr>

      </table>
    </td></tr>

    <!-- Footer -->
    <tr><td class="email-footer" style="padding:24px 16px;text-align:center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        <tr><td align="center">
          <div style="font-size:12px;color:#94a3b8;line-height:1.6">
            Envoye via <a href="https://terranoweb.win" style="color:#10b981;text-decoration:none;font-weight:600">TerranoWeb</a>
          </div>
          <div style="font-size:11px;color:#cbd5e1;margin-top:8px">
            Ce message a ete envoye par un utilisateur de TerranoWeb.
            Vous pouvez repondre directement a cet email.
          </div>
        </td></tr>
      </table>
    </td></tr>

  </table>

</td></tr>
</table>

</body>
</html>`
}

// =====================================================================
// Auth middleware helper
// =====================================================================
function requireAuth(req) {
  const token = getSessionToken(req)
  const user = getSessionUser(token)
  return user // null if not authenticated
}

// =====================================================================
// Route handler — all /api/mail/* routes
// =====================================================================
async function handleMail(req, res, url, readBody) {
  const pathname = url.pathname
  const subpath = pathname.replace('/api/mail/', '')
  const parts = subpath.split('/')
  const resource = parts[0]
  const resourceId = parts[1] || null

  try {
    // POST /api/mail/incoming — Webhook for incoming external emails (no session auth, uses secret)
    if (resource === 'incoming' && req.method === 'POST') {
      return handleIncoming(req, res, readBody)
    }

    // Auth check
    const user = requireAuth(req)
    if (!user) {
      return sendJson(res, 401, { ok: false, error: 'Non authentifie' })
    }

    // GET /api/mail/inbox?folder=inbox&page=1&limit=20&search=...
    if (resource === 'inbox' && req.method === 'GET') {
      return handleInbox(req, res, url, user)
    }

    // GET /api/mail/message/:id
    if (resource === 'message' && resourceId && req.method === 'GET') {
      return handleGetMessage(req, res, resourceId, user)
    }

    // PUT /api/mail/message/:id
    if (resource === 'message' && resourceId && req.method === 'PUT') {
      return handleUpdateMessage(req, res, resourceId, user, readBody)
    }

    // DELETE /api/mail/message/:id
    if (resource === 'message' && resourceId && req.method === 'DELETE') {
      return handleDeleteMessage(req, res, url, resourceId, user)
    }

    // POST /api/mail/send
    if (resource === 'send' && req.method === 'POST') {
      return handleSend(req, res, user, readBody)
    }

    // GET /api/mail/unread
    if (resource === 'unread' && req.method === 'GET') {
      return handleUnread(req, res, user)
    }

    // GET /api/mail/contacts?q=...
    if (resource === 'contacts' && req.method === 'GET') {
      return handleGetContacts(req, res, url, user)
    }

    // POST /api/mail/contacts
    if (resource === 'contacts' && req.method === 'POST') {
      return handleAddContact(req, res, user, readBody)
    }

    // GET /api/mail/attachment/:id
    if (resource === 'attachment' && resourceId && req.method === 'GET') {
      return handleGetAttachment(req, res, resourceId, user)
    }

    sendJson(res, 404, { ok: false, error: 'Route mail non trouvee' })
  } catch (err) {
    console.error('[Mail] Error:', err.message)
    sendJson(res, 500, { ok: false, error: 'Erreur serveur interne' })
  }
}

// =====================================================================
// GET /api/mail/inbox — List messages by folder
// =====================================================================
function handleInbox(req, res, url, user) {
  const db = getDb()
  const folderParam = url.searchParams.get('folder') || 'inbox'
  const validFolders = ['inbox', 'sent', 'drafts', 'trash', 'starred']
  if (!validFolders.includes(folderParam)) {
    return sendJson(res, 400, { ok: false, error: 'Dossier invalide' })
  }
  const folder = folderParam
  const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1)
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit')) || 20))
  const search = (url.searchParams.get('search') || '').trim().slice(0, config.MAX_SEARCH_QUERY)
  const offset = (page - 1) * limit

  let where = ''
  let countWhere = ''
  let params = []
  let countParams = []

  if (folder === 'starred') {
    where = 'WHERE m.to_id = ? AND m.is_starred = 1 AND m.folder != \'trash\''
    countWhere = where
    params = [user.id]
    countParams = [user.id]
  } else if (folder === 'sent') {
    where = 'WHERE m.from_id = ? AND m.sender_folder = \'sent\''
    countWhere = where
    params = [user.id]
    countParams = [user.id]
  } else if (folder === 'drafts') {
    where = 'WHERE m.from_id = ? AND m.sender_folder = \'drafts\''
    countWhere = where
    params = [user.id]
    countParams = [user.id]
  } else if (folder === 'trash') {
    where = 'WHERE ((m.to_id = ? AND m.folder = \'trash\') OR (m.from_id = ? AND m.sender_folder = \'trash\'))'
    countWhere = where
    params = [user.id, user.id]
    countParams = [user.id, user.id]
  } else {
    // inbox (default)
    where = 'WHERE m.to_id = ? AND m.folder = \'inbox\''
    countWhere = where
    params = [user.id]
    countParams = [user.id]
  }

  if (search) {
    where += ' AND (m.subject LIKE ? OR m.body LIKE ?)'
    countWhere += ' AND (m.subject LIKE ? OR m.body LIKE ?)'
    const searchParam = `%${search}%`
    params.push(searchParam, searchParam)
    countParams.push(searchParam, searchParam)
  }

  const total = db.prepare(`SELECT COUNT(*) as c FROM mail_messages m ${countWhere}`).get(...countParams).c
  const pages = Math.ceil(total / limit) || 1

  const messages = db.prepare(`
    SELECT m.id, m.from_id, m.to_id, m.subject, m.body, m.is_read, m.is_starred,
           m.folder, m.sender_folder, m.has_attachment, m.created_at, m.parent_id, m.external_to, m.external_from,
           sender.username as from_username, sender.display_name as from_display_name, sender.email as from_email,
           recip.username as to_username, recip.display_name as to_display_name, recip.email as to_email
    FROM mail_messages m
    JOIN web_accounts sender ON sender.id = m.from_id
    JOIN web_accounts recip ON recip.id = m.to_id
    ${where}
    ORDER BY m.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset)

  const result = messages.map(m => {
    const toData = m.external_to
      ? { id: null, username: m.external_to, displayName: m.external_to, email: m.external_to, isExternal: true }
      : { id: m.to_id, username: m.to_username, displayName: m.to_display_name, email: m.to_email }

    // If external_from is set, this is an incoming external email
    const fromData = m.external_from
      ? { id: null, username: m.external_from, displayName: m.external_from, email: m.external_from, isExternal: true }
      : { id: m.from_id, username: m.from_username, displayName: m.from_display_name, email: m.from_email }

    return {
      id: m.id,
      subject: m.subject,
      preview: m.body.substring(0, 120).replace(/\n/g, ' '),
      isRead: !!m.is_read,
      isStarred: !!m.is_starred,
      hasAttachment: !!m.has_attachment,
      parentId: m.parent_id,
      createdAt: m.created_at,
      from: fromData,
      to: toData
    }
  })

  sendJson(res, 200, { ok: true, messages: result, total, page, pages, folder })
}

// =====================================================================
// GET /api/mail/message/:id — Read a single message
// =====================================================================
function handleGetMessage(req, res, id, user) {
  const db = getDb()
  const m = db.prepare(`
    SELECT m.*, m.external_to, m.external_from,
           sender.username as from_username, sender.display_name as from_display_name, sender.email as from_email,
           recip.username as to_username, recip.display_name as to_display_name, recip.email as to_email
    FROM mail_messages m
    JOIN web_accounts sender ON sender.id = m.from_id
    JOIN web_accounts recip ON recip.id = m.to_id
    WHERE m.id = ? AND (m.to_id = ? OR m.from_id = ?)
  `).get(id, user.id, user.id)

  if (!m) {
    return sendJson(res, 404, { ok: false, error: 'Message non trouve' })
  }

  // Mark as read if user is recipient
  if (m.to_id === user.id && !m.is_read) {
    db.prepare('UPDATE mail_messages SET is_read = 1, updated_at = ? WHERE id = ?').run(Date.now(), id)
  }

  // Get attachments metadata (no blob data)
  const attachments = db.prepare(
    'SELECT id, filename, mime_type, size_bytes, created_at FROM mail_attachments WHERE message_id = ?'
  ).all(id)

  const toData = m.external_to
    ? { id: null, username: m.external_to, displayName: m.external_to, email: m.external_to, isExternal: true }
    : { id: m.to_id, username: m.to_username, displayName: m.to_display_name, email: m.to_email }

  const fromData = m.external_from
    ? { id: null, username: m.external_from, displayName: m.external_from, email: m.external_from, isExternal: true }
    : { id: m.from_id, username: m.from_username, displayName: m.from_display_name, email: m.from_email }

  sendJson(res, 200, {
    ok: true,
    message: {
      id: m.id,
      subject: m.subject,
      body: m.body,
      isRead: true,
      isStarred: !!m.is_starred,
      hasAttachment: !!m.has_attachment,
      parentId: m.parent_id,
      threadId: m.thread_id,
      createdAt: m.created_at,
      from: fromData,
      to: toData,
      attachments
    }
  })
}

// =====================================================================
// POST /api/mail/send — Send a message or save draft
// =====================================================================
async function handleSend(req, res, user, readBody) {
  // Rate limit: 10 emails per minute per user
  const rl = checkRateLimit('mail-send', user.id,
    config.RATE_LIMIT.MAIL_SEND_WINDOW_MS, config.RATE_LIMIT.MAIL_SEND_MAX)
  if (rl.limited) {
    console.log(`[Security] Mail send rate limit hit for user ${user.username}`)
    return sendJson(res, 429, { ok: false, error: 'Trop d\'emails envoyes. Reessayez dans une minute.' })
  }

  const body = await readBody(req)

  // Check oversized body or invalid content type
  if (body && body.__oversized) {
    return sendJson(res, 413, { ok: false, error: 'Requete trop volumineuse' })
  }
  if (body && body.__invalidContentType) {
    return sendJson(res, 415, { ok: false, error: 'Content-Type doit etre application/json' })
  }

  const to = (body.to || '').trim().toLowerCase().slice(0, config.MAX_EMAIL_ADDRESS)
  const subject = (body.subject || '').trim().slice(0, config.MAX_EMAIL_SUBJECT)
  const msgBody = (body.body || '').trim().slice(0, config.MAX_EMAIL_BODY)
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const parentId = (typeof body.parentId === 'string' && UUID_REGEX.test(body.parentId)) ? body.parentId : null
  const isDraft = body.isDraft === true
  const attachments = Array.isArray(body.attachments) ? body.attachments : []

  if (!to) {
    return sendJson(res, 400, { ok: false, error: 'Destinataire requis' })
  }

  // Validate attachments: MIME type + extension + size
  let totalAttachSize = 0
  for (const att of attachments) {
    if (!att.filename || !att.data) continue

    // Check blocked extensions
    if (isBlockedExtension(att.filename)) {
      return sendJson(res, 400, { ok: false, error: `Type de fichier non autorise : "${escapeHtml(att.filename)}"` })
    }

    // Check MIME type
    const mimeType = att.mimeType || 'application/octet-stream'
    if (!isAllowedMime(mimeType)) {
      return sendJson(res, 400, { ok: false, error: `Type MIME non autorise : "${escapeHtml(mimeType)}"` })
    }

    const bytes = Buffer.from(att.data, 'base64')
    if (bytes.length > 10 * 1024 * 1024) {
      return sendJson(res, 400, { ok: false, error: `Piece jointe "${escapeHtml(att.filename)}" trop volumineuse (max 10 Mo)` })
    }
    totalAttachSize += bytes.length
  }
  if (totalAttachSize > 25 * 1024 * 1024) {
    return sendJson(res, 400, { ok: false, error: 'Total des pieces jointes trop volumineux (max 25 Mo)' })
  }

  // Determine if internal or external
  const db = getDb()
  let isExternal = false
  let externalEmail = null
  let recipUsername = to

  if (to.includes('@')) {
    const parts = to.split('@')
    const domain = parts[1]
    if (domain && domain !== 'terranoweb.win') {
      // External email
      isExternal = true
      externalEmail = to
    } else {
      recipUsername = parts[0]
    }
  }

  // Validate email format for external
  if (isExternal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(externalEmail)) {
    return sendJson(res, 400, { ok: false, error: 'Adresse email invalide' })
  }

  let recipient = null
  if (!isExternal) {
    recipient = db.prepare('SELECT id, username, email, display_name FROM web_accounts WHERE username = ?').get(recipUsername)
    if (!recipient) {
      return sendJson(res, 400, { ok: false, error: 'Utilisateur introuvable. Verifiez le nom d\'utilisateur.' })
    }
  }

  const now = Date.now()
  const id = randomUUID()

  // Resolve thread (verify access: parentId must belong to this user)
  let threadId = id
  if (parentId) {
    const parent = db.prepare(
      'SELECT thread_id FROM mail_messages WHERE id = ? AND (from_id = ? OR to_id = ?)'
    ).get(parentId, user.id, user.id)
    if (parent) threadId = parent.thread_id
  }

  const folder = isDraft ? 'drafts' : (isExternal ? 'sent' : 'inbox')
  const senderFolder = isDraft ? 'drafts' : 'sent'
  const hasAttachment = attachments.length > 0 ? 1 : 0

  // For external: to_id = from_id (self), external_to = email
  const toId = isExternal ? user.id : recipient.id

  db.transaction(() => {
    db.prepare(`
      INSERT INTO mail_messages (id, from_id, to_id, subject, body, parent_id, thread_id,
        is_read, is_starred, folder, sender_folder, has_attachment, external_to, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?)
    `).run(id, user.id, toId, subject, msgBody, parentId, threadId, folder, senderFolder, hasAttachment, externalEmail, now, now)

    // Insert attachments
    for (const att of attachments) {
      if (!att.filename || !att.data) continue
      const attId = randomUUID()
      const bytes = Buffer.from(att.data, 'base64')
      const mimeType = att.mimeType || 'application/octet-stream'
      db.prepare(`
        INSERT INTO mail_attachments (id, message_id, filename, mime_type, size_bytes, data, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(attId, id, att.filename.slice(0, 255), mimeType, bytes.length, bytes, now)
    }
  })()

  // Send via SMTP if external (and not a draft)
  if (isExternal && !isDraft) {
    try {
      const senderName = sanitizeHeaderValue(user.displayName || user.username)
      const safeReplyEmail = sanitizeHeaderValue(user.email)
      const emailSubject = subject || '(sans objet)'
      const mailOptions = {
        from: `"${senderName} via TerranoWeb" <noreply@terranomail.org>`,
        replyTo: `"${senderName}" <${safeReplyEmail}>`,
        to: externalEmail,
        subject: emailSubject,
        text: msgBody,
        html: buildEmailHtml(user.displayName || user.username, user.email, emailSubject, msgBody)
      }

      // Add attachments if any
      if (attachments.length > 0) {
        mailOptions.attachments = attachments
          .filter(a => a.filename && a.data)
          .map(a => ({
            filename: a.filename.slice(0, 255),
            content: a.data,
            encoding: 'base64',
            contentType: a.mimeType || 'application/octet-stream'
          }))
      }

      const transport = await getSmtpTransport()
      await transport.sendMail(mailOptions)
      console.log(`[Mail] External email sent to ${externalEmail} from ${user.email}`)
    } catch (smtpErr) {
      console.error('[Mail] SMTP error:', smtpErr.message)
      // Delete the saved message since SMTP failed
      db.transaction(() => {
        db.prepare('DELETE FROM mail_attachments WHERE message_id = ?').run(id)
        db.prepare('DELETE FROM mail_messages WHERE id = ?').run(id)
      })()
      // Generic error message — don't expose SMTP details to client
      return sendJson(res, 500, { ok: false, error: 'Erreur lors de l\'envoi de l\'email. Veuillez reessayer plus tard.' })
    }
  }

  const toEmail = isExternal ? externalEmail : recipient.email
  sendJson(res, 200, {
    ok: true,
    message: { id, subject, to: toEmail, isDraft, isExternal, createdAt: now }
  })
}

// =====================================================================
// PUT /api/mail/message/:id — Update message properties
// =====================================================================
async function handleUpdateMessage(req, res, id, user, readBody) {
  const db = getDb()
  const m = db.prepare('SELECT * FROM mail_messages WHERE id = ? AND (to_id = ? OR from_id = ?)').get(id, user.id, user.id)
  if (!m) {
    return sendJson(res, 404, { ok: false, error: 'Message non trouve' })
  }

  const body = await readBody(req)

  // Check oversized body or invalid content type
  if (body && body.__oversized) {
    return sendJson(res, 413, { ok: false, error: 'Requete trop volumineuse' })
  }
  if (body && body.__invalidContentType) {
    return sendJson(res, 415, { ok: false, error: 'Content-Type doit etre application/json' })
  }

  const now = Date.now()
  const updates = []
  const params = []

  if (typeof body.isRead === 'boolean' && m.to_id === user.id) {
    updates.push('is_read = ?')
    params.push(body.isRead ? 1 : 0)
  }
  if (typeof body.isStarred === 'boolean') {
    updates.push('is_starred = ?')
    params.push(body.isStarred ? 1 : 0)
  }
  if (body.folder && m.to_id === user.id) {
    // Validate folder value
    const validFolders = ['inbox', 'trash', 'archive']
    if (validFolders.includes(body.folder)) {
      updates.push('folder = ?')
      params.push(body.folder)
    }
  }
  if (body.folder && m.from_id === user.id) {
    const validFolders = ['sent', 'trash', 'drafts']
    if (validFolders.includes(body.folder)) {
      updates.push('sender_folder = ?')
      params.push(body.folder)
    }
  }

  if (updates.length > 0) {
    updates.push('updated_at = ?')
    params.push(now, id)
    db.prepare(`UPDATE mail_messages SET ${updates.join(', ')} WHERE id = ?`).run(...params)
  }

  sendJson(res, 200, { ok: true })
}

// =====================================================================
// DELETE /api/mail/message/:id — Move to trash or permanent delete
// =====================================================================
function handleDeleteMessage(req, res, url, id, user) {
  const db = getDb()
  const permanent = url.searchParams?.get('permanent') === 'true'
  const m = db.prepare('SELECT * FROM mail_messages WHERE id = ? AND (to_id = ? OR from_id = ?)').get(id, user.id, user.id)

  if (!m) {
    return sendJson(res, 404, { ok: false, error: 'Message non trouve' })
  }

  const now = Date.now()

  if (permanent) {
    // Only allow permanent delete from trash
    db.transaction(() => {
      db.prepare('DELETE FROM mail_attachments WHERE message_id = ?').run(id)
      db.prepare('DELETE FROM mail_messages WHERE id = ?').run(id)
    })()
  } else {
    // Soft delete -> move to trash
    if (m.to_id === user.id) {
      db.prepare('UPDATE mail_messages SET folder = \'trash\', deleted_at = ?, updated_at = ? WHERE id = ?').run(now, now, id)
    }
    if (m.from_id === user.id) {
      db.prepare('UPDATE mail_messages SET sender_folder = \'trash\', deleted_at = ?, updated_at = ? WHERE id = ?').run(now, now, id)
    }
  }

  sendJson(res, 200, { ok: true })
}

// =====================================================================
// GET /api/mail/unread — Unread count
// =====================================================================
function handleUnread(req, res, user) {
  const db = getDb()
  const row = db.prepare(
    'SELECT COUNT(*) as c FROM mail_messages WHERE to_id = ? AND folder = \'inbox\' AND is_read = 0'
  ).get(user.id)
  sendJson(res, 200, { ok: true, count: row.c })
}

// =====================================================================
// GET /api/mail/contacts?q=... — Search users for autocomplete
// =====================================================================
function handleGetContacts(req, res, url, user) {
  const db = getDb()
  const q = (url.searchParams.get('q') || '').trim().slice(0, config.MAX_SEARCH_QUERY)

  if (q) {
    const search = `%${q}%`
    const contacts = db.prepare(`
      SELECT id, username, email, display_name FROM web_accounts
      WHERE (username LIKE ? OR display_name LIKE ? OR email LIKE ?) AND id != ?
      LIMIT 10
    `).all(search, search, search, user.id)

    return sendJson(res, 200, {
      ok: true,
      contacts: contacts.map(c => ({
        id: c.id, username: c.username, email: c.email, displayName: c.display_name
      }))
    })
  }

  // Return saved contacts
  const contacts = db.prepare(`
    SELECT c.id as contact_row_id, c.nickname, a.id, a.username, a.email, a.display_name
    FROM mail_contacts c
    JOIN web_accounts a ON a.id = c.contact_id
    WHERE c.owner_id = ?
    ORDER BY a.display_name
  `).all(user.id)

  sendJson(res, 200, {
    ok: true,
    contacts: contacts.map(c => ({
      id: c.id, username: c.username, email: c.email, displayName: c.display_name, nickname: c.nickname
    }))
  })
}

// =====================================================================
// POST /api/mail/contacts — Save a contact
// =====================================================================
async function handleAddContact(req, res, user, readBody) {
  const body = await readBody(req)

  // Check oversized body or invalid content type
  if (body && body.__oversized) {
    return sendJson(res, 413, { ok: false, error: 'Requete trop volumineuse' })
  }
  if (body && body.__invalidContentType) {
    return sendJson(res, 415, { ok: false, error: 'Content-Type doit etre application/json' })
  }

  const contactId = body.contactId
  if (!contactId) {
    return sendJson(res, 400, { ok: false, error: 'contactId requis' })
  }

  const db = getDb()
  const contact = db.prepare('SELECT id FROM web_accounts WHERE id = ?').get(contactId)
  if (!contact) {
    return sendJson(res, 400, { ok: false, error: 'Contact introuvable' })
  }

  try {
    db.prepare(`
      INSERT INTO mail_contacts (id, owner_id, contact_id, nickname, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(randomUUID(), user.id, contactId, typeof body.nickname === 'string' ? body.nickname.trim().slice(0, 50) : null, Date.now())
  } catch (e) {
    // UNIQUE constraint — already a contact
    if (e.message.includes('UNIQUE')) {
      return sendJson(res, 200, { ok: true, alreadyExists: true })
    }
    throw e
  }

  sendJson(res, 200, { ok: true })
}

// =====================================================================
// GET /api/mail/attachment/:id — Download attachment
// =====================================================================
function handleGetAttachment(req, res, id, user) {
  const db = getDb()
  const att = db.prepare(`
    SELECT a.*, m.from_id, m.to_id
    FROM mail_attachments a
    JOIN mail_messages m ON m.id = a.message_id
    WHERE a.id = ? AND (m.to_id = ? OR m.from_id = ?)
  `).get(id, user.id, user.id)

  if (!att) {
    return sendJson(res, 404, { ok: false, error: 'Piece jointe non trouvee' })
  }

  // Sanitize filename for Content-Disposition header
  const safeFilename = att.filename.replace(/[^\w.\-]/g, '_')

  res.writeHead(200, {
    'Content-Type': att.mime_type,
    'Content-Disposition': `attachment; filename="${safeFilename}"`,
    'Content-Length': att.size_bytes,
    'X-Content-Type-Options': 'nosniff'
  })
  res.end(att.data)
}

// =====================================================================
// POST /api/mail/incoming — Receive external email via webhook
// =====================================================================
async function handleIncoming(req, res, readBody) {
  const clientIp = req.clientIp || req.socket.remoteAddress || 'unknown'

  // Rate limit: 30 webhook calls per minute per IP
  const rl = checkRateLimit('webhook', clientIp,
    config.RATE_LIMIT.WEBHOOK_WINDOW_MS, config.RATE_LIMIT.WEBHOOK_MAX)
  if (rl.limited) {
    console.log(`[Security] Webhook rate limit hit for IP ${clientIp}`)
    return sendJson(res, 429, { ok: false, error: 'Too many requests' })
  }

  try {
    const body = await readBody(req)

    // Check oversized body or invalid content type
    if (body && body.__oversized) {
      return sendJson(res, 413, { ok: false, error: 'Payload too large' })
    }
    if (body && body.__invalidContentType) {
      return sendJson(res, 415, { ok: false, error: 'Content-Type must be application/json' })
    }

    // Verify webhook secret (timing-safe comparison to prevent timing attacks)
    const secretValid = body.secret && config.WEBHOOK_SECRET
      && Buffer.byteLength(String(body.secret)) === Buffer.byteLength(config.WEBHOOK_SECRET)
      && timingSafeEqual(Buffer.from(String(body.secret)), Buffer.from(config.WEBHOOK_SECRET))
    if (!secretValid) {
      console.error('[Mail Incoming] Invalid webhook secret')
      return sendJson(res, 403, { ok: false, error: 'Invalid secret' })
    }

    const fromEmail = (body.from || '').trim().toLowerCase().slice(0, config.MAX_EMAIL_ADDRESS)
    const toEmail = (body.to || '').trim().toLowerCase().slice(0, config.MAX_EMAIL_ADDRESS)
    const subject = (body.subject || '').trim().slice(0, config.MAX_EMAIL_SUBJECT)
    const msgBody = (body.body || '').trim().slice(0, config.MAX_EMAIL_BODY)
    const fromName = (body.fromName || '').trim().slice(0, config.MAX_NAME_LENGTH) || fromEmail

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!fromEmail || !emailRegex.test(fromEmail)) {
      return sendJson(res, 400, { ok: false, error: 'Invalid from address' })
    }
    if (!toEmail || !emailRegex.test(toEmail)) {
      return sendJson(res, 400, { ok: false, error: 'Invalid to address' })
    }

    // Extract username from to address (user@terranoweb.win)
    const atIdx = toEmail.indexOf('@')
    if (atIdx === -1) {
      return sendJson(res, 400, { ok: false, error: 'Invalid to address' })
    }
    const toUsername = toEmail.substring(0, atIdx)
    const toDomain = toEmail.substring(atIdx + 1)

    if (toDomain !== 'terranoweb.win') {
      return sendJson(res, 400, { ok: false, error: 'Not a terranoweb.win address' })
    }

    // Find recipient user
    const db = getDb()
    const recipient = db.prepare(
      'SELECT id, username, email, display_name FROM web_accounts WHERE username = ? OR email = ?'
    ).get(toUsername, toEmail)

    if (!recipient) {
      console.error(`[Mail Incoming] User not found: ${toUsername}`)
      return sendJson(res, 404, { ok: false, error: 'User not found' })
    }

    const now = Date.now()
    const id = randomUUID()

    db.prepare(`
      INSERT INTO mail_messages (id, from_id, to_id, subject, body, parent_id, thread_id,
        is_read, is_starred, folder, sender_folder, has_attachment, external_from, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, NULL, ?, 0, 0, 'inbox', 'sent', 0, ?, ?, ?)
    `).run(id, recipient.id, recipient.id, subject, msgBody, id, fromEmail, now, now)

    console.log(`[Mail Incoming] Email from ${fromEmail} to ${toEmail} stored (id: ${id})`)
    sendJson(res, 200, { ok: true, id })
  } catch (err) {
    console.error('[Mail Incoming] Error:', err.message)
    sendJson(res, 500, { ok: false, error: 'Internal error' })
  }
}

// =====================================================================
function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data))
}

module.exports = { handleMail }
