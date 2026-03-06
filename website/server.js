const http = require('http')
const fs = require('fs')
const path = require('path')
const { initDb } = require('./db')
const { handleAuth, cleanupAuthTables } = require('./api/auth')
const { handleNews, warmCache } = require('./api/news')
const { handleVideos, warmVideoCache } = require('./api/videos')
const { handleBreaking, warmBreaking } = require('./api/breaking')
const { handleSearch, handleSearchImages, handleSearchVideos } = require('./api/search')
const { handleSmartSearch } = require('./api/smart-search')
const { handleTrends, warmTrendsCache } = require('./api/trends')
const { handleIranNews, warmIranCache } = require('./api/iran-news')
const { handleMail } = require('./api/mail')
const { handleProxy } = require('./api/proxy')
const config = require('./config')
const { checkRateLimit } = require('./rateLimit')

const PORT = 80
const ROOT = path.resolve(__dirname)

// --- Fichiers et dossiers serveur bloqués (jamais servis en statique) ---
const BLOCKED_FILES = new Set([
  'secrets.json', 'secrets.json.example', 'config.js', 'db.js',
  'rateLimit.js', 'server.js', 'package.json', 'package-lock.json',
  'portal.db', 'portal.db-shm', 'portal.db-wal', '.gitignore'
])
const BLOCKED_DIRS = ['api/', 'node_modules/']

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.exe': 'application/x-msdownload',
  '.apk': 'application/vnd.android.package-archive',
  '.idsig': 'application/octet-stream',
  '.yml': 'text/yaml',
  '.yaml': 'text/yaml',
  '.blockmap': 'application/octet-stream'
}

// --- Extract client IP (FIX 4: Ne plus faire confiance à X-Forwarded-For) ---
function getClientIp(req) {
  // Cloudflare : cf-connecting-ip est fiable (ajouté par Cloudflare, pas forgeable)
  if (req.headers['cf-connecting-ip']) {
    return req.headers['cf-connecting-ip']
  }
  // Fallback : IP socket directe (ne peut PAS être forgée par le client)
  // X-Forwarded-For est IGNORÉ car forgeable sans reverse proxy de confiance
  return req.socket.remoteAddress || 'unknown'
}

// --- Body parser helper (with size limit) ---
// FIX 11: Protection prototype pollution
function sanitizeBody(obj) {
  if (obj && typeof obj === 'object') {
    delete obj['__proto__']
    delete obj['constructor']
    delete obj['prototype']
  }
  return obj
}

function readBody(req, maxBytes) {
  // FIX 9: Validation Content-Type
  const ct = (req.headers['content-type'] || '').split(';')[0].trim()
  if (ct && ct !== 'application/json') {
    return Promise.resolve({ __invalidContentType: true })
  }

  const limit = maxBytes || config.BODY_SIZE_LIMIT
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    let destroyed = false
    req.on('data', c => {
      if (destroyed) return
      size += c.length
      if (size > limit) {
        destroyed = true
        req.destroy()
        resolve({ __oversized: true })
        return
      }
      chunks.push(c)
    })
    req.on('end', () => {
      if (destroyed) return
      try {
        resolve(sanitizeBody(JSON.parse(Buffer.concat(chunks).toString())))
      } catch {
        resolve({})
      }
    })
    req.on('error', reject)
  })
}

// --- Static file server ---
function serveStatic(req, res, pathname) {
  // FIX 1: Bloquer l'accès aux fichiers sensibles du serveur
  const normalized = pathname.replace(/^\/+/, '').toLowerCase()
  if (BLOCKED_FILES.has(normalized) || BLOCKED_DIRS.some(d => normalized.startsWith(d))) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }

  // FIX 2: Path traversal renforcé avec path.resolve()
  let filePath = path.resolve(path.join(ROOT, pathname === '/' ? 'index.html' : pathname))

  // Prevent directory traversal — vérifie que le chemin résolu est dans ROOT
  if (!filePath.startsWith(ROOT + path.sep) && filePath !== path.join(ROOT, 'index.html')) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }

  const ext = path.extname(filePath)
  const contentType = MIME[ext] || 'application/octet-stream'

  // Downloadable file types — stream instead of loading into memory
  const DOWNLOADABLE_EXTS = new Set(['.exe', '.apk', '.blockmap', '.zip', '.msi', '.dmg'])
  const STREAMABLE_EXTS = new Set(['.mp4', '.webm', '.ogg', '.mp3'])

  // Video/audio streaming with Range request support
  if (STREAMABLE_EXTS.has(ext)) {
    fs.stat(filePath, (err, stats) => {
      if (err) {
        res.writeHead(404); res.end('Not Found'); return
      }
      const total = stats.size
      const range = req.headers.range
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-')
        const start = parseInt(parts[0], 10)
        const end = parts[1] ? parseInt(parts[1], 10) : total - 1
        const chunkSize = end - start + 1
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${total}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': contentType
        })
        fs.createReadStream(filePath, { start, end }).pipe(res)
      } else {
        res.writeHead(200, {
          'Content-Length': total,
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=3600'
        })
        fs.createReadStream(filePath).pipe(res)
      }
    })
    return
  }

  if (DOWNLOADABLE_EXTS.has(ext)) {
    fs.stat(filePath, (err, stats) => {
      if (err) {
        // Fallback to index.html (SPA behavior)
        fs.readFile(path.join(ROOT, 'index.html'), (err2, data2) => {
          if (err2) { res.writeHead(404); res.end('Not Found'); return }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(data2)
        })
        return
      }
      const filename = path.basename(filePath)
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': stats.size,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache'
      })
      fs.createReadStream(filePath).pipe(res)
    })
    return
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // Fallback to index.html (SPA behavior)
      fs.readFile(path.join(ROOT, 'index.html'), (err2, data2) => {
        if (err2) {
          res.writeHead(404)
          res.end('Not Found')
          return
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(data2)
      })
      return
    }
    const charset = ['.html', '.css', '.js', '.json', '.svg'].includes(ext) ? '; charset=utf-8' : ''
    const headers = { 'Content-Type': contentType + charset }
    // Short cache for images, no cache for HTML
    if (['.png', '.jpg', '.jpeg', '.svg', '.ico', '.webp'].includes(ext)) {
      headers['Cache-Control'] = 'public, max-age=300'
    } else if (ext === '.html' || ext === '.yml' || ext === '.yaml') {
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    }
    res.writeHead(200, headers)
    res.end(data)
  })
}

// --- Initialize database ---
initDb()

// --- HTTP Server ---
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  const pathname = url.pathname

  // ===================== SECURITY HEADERS (all responses) =====================
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('X-XSS-Protection', '0')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://static.cloudflareinsights.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "worker-src 'self' blob:",
    "connect-src 'self' https://*.rttv.com https://cdn.jsdelivr.net blob:",
    "media-src 'self' https://*.rttv.com blob:",
    "frame-src https://www.youtube.com https://www.youtube-nocookie.com https://rutube.ru",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; '))

  // ===================== CLIENT IP =====================
  const clientIp = getClientIp(req)
  req.clientIp = clientIp

  // ===================== PROXY (avant CORS/rate limit — gère ses propres headers) =====================
  if (pathname === '/api/proxy') {
    return handleProxy(req, res, url)
  }

  // ===================== CORS for API =====================
  if (pathname.startsWith('/api/')) {
    res.setHeader('Access-Control-Allow-Origin', 'https://terranoweb.win')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.setHeader('Access-Control-Allow-Credentials', 'true')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }
    const rl = checkRateLimit('global', clientIp,
      config.RATE_LIMIT.GLOBAL_WINDOW_MS, config.RATE_LIMIT.GLOBAL_MAX)
    if (rl.limited) {
      console.log(`[Security] Global rate limit hit for IP ${clientIp}`)
      res.writeHead(429, {
        'Content-Type': 'application/json',
        'Retry-After': Math.ceil(rl.retryAfterMs / 1000).toString()
      })
      res.end(JSON.stringify({ ok: false, error: 'Trop de requetes. Reessayez plus tard.' }))
      return
    }

    // ===================== CSRF ORIGIN CHECK (FIX 3: Origin + Referer + reject si absent) =====================
    if (req.method !== 'GET' && req.method !== 'OPTIONS') {
      const origin = req.headers['origin']
      const referer = req.headers['referer']
      const allowedHosts = ['terranoweb.win', 'localhost', '127.0.0.1']
      let csrfOk = false

      if (origin) {
        try {
          const h = new URL(origin).hostname
          csrfOk = allowedHosts.includes(h)
        } catch { csrfOk = false }
      } else if (referer) {
        try {
          const h = new URL(referer).hostname
          csrfOk = allowedHosts.includes(h)
        } catch { csrfOk = false }
      } else {
        // Ni Origin ni Referer — autoriser uniquement le webhook incoming (appel serveur externe)
        csrfOk = pathname === '/api/mail/incoming'
      }

      if (!csrfOk) {
        console.log(`[Security] CSRF blocked: origin=${origin || 'none'} referer=${referer || 'none'} ip=${clientIp}`)
        res.writeHead(403, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: 'Origine non autorisee' }))
        return
      }
    }
  }

  // API routing
  if (pathname.startsWith('/api/auth/')) {
    return handleAuth(req, res, url, readBody)
  }

  if (pathname === '/api/news') {
    return handleNews(req, res, url)
  }

  if (pathname === '/api/videos') {
    return handleVideos(req, res, url)
  }

  if (pathname === '/api/breaking') {
    return handleBreaking(req, res)
  }

  if (pathname === '/api/search') {
    return handleSearch(req, res, url)
  }
  if (pathname === '/api/search/images') {
    return handleSearchImages(req, res, url)
  }
  if (pathname === '/api/search/videos') {
    return handleSearchVideos(req, res, url)
  }
  if (pathname === '/api/search/smart') {
    return handleSmartSearch(req, res, url)
  }
  if (pathname === '/api/trends') {
    return handleTrends(req, res)
  }

  if (pathname === '/api/news/iran') {
    return handleIranNews(req, res)
  }

  // Mail API (pass higher body limit for attachments)
  if (pathname.startsWith('/api/mail')) {
    return handleMail(req, res, url, (r) => readBody(r, config.MAIL_BODY_SIZE_LIMIT))
  }

  // Serve mail page
  if (pathname === '/mail') {
    const mailPage = path.join(ROOT, 'mail.html')
    fs.readFile(mailPage, (err, data) => {
      if (err) { res.writeHead(404); res.end('Not Found'); return }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' })
      res.end(data)
    })
    return
  }

  // Serve registration page (dedicated page with full registration flow)
  if (pathname === '/register') {
    const regPage = path.join(ROOT, 'register.html')
    fs.readFile(regPage, (err, data) => {
      if (err) { res.writeHead(404); res.end('Not Found'); return }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' })
      res.end(data)
    })
    return
  }

  // Serve search results page
  if (pathname === '/search') {
    const searchPage = path.join(ROOT, 'search.html')
    fs.readFile(searchPage, (err, data) => {
      if (err) { res.writeHead(404); res.end('Not Found'); return }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' })
      res.end(data)
    })
    return
  }

  // Static files
  serveStatic(req, res, pathname)
})

// Empêcher les crashes sur les rejections non-gérées (ex: AbortSignal.timeout)
process.on('unhandledRejection', (err) => {
  console.error('[Process] Unhandled rejection:', err?.message || err)
})
process.on('uncaughtException', (err) => {
  console.error('[Process] Uncaught exception:', err?.message || err)
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] TerranoWeb Portal running on http://localhost:${PORT}`)

  // Warm caches in background
  setTimeout(() => warmCache(), 2000)
  setTimeout(() => warmVideoCache(), 4000)
  setTimeout(() => warmBreaking(), 3000)
  setTimeout(() => warmTrendsCache(), 5000)
  setTimeout(() => warmIranCache(), 6000)

  // FIX 6: Nettoyage périodique des sessions expirées et login_attempts
  setTimeout(() => cleanupAuthTables(), 10000) // Premier nettoyage 10s après démarrage
  setInterval(() => cleanupAuthTables(), 60 * 60 * 1000) // Puis toutes les heures
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] Shutting down...')
  server.close()
  require('./db').closeDb()
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('[Server] Shutting down...')
  server.close()
  require('./db').closeDb()
  process.exit(0)
})
