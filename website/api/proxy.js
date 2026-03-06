/**
 * proxy.js — Proxy anti-géoblocage intégré au serveur
 *
 * Permet de relayer les contenus géo-bloqués (streams HLS, articles, flux)
 * via le serveur local au lieu d'un accès direct depuis le client.
 *
 * Fonctionnalités :
 *  - Proxy générique GET avec streaming (pipe sans bufferiser)
 *  - Réécriture m3u8 (HLS) : segments + sous-playlists routés via /api/proxy
 *  - Whitelist de domaines (sécurité anti-SSRF)
 *  - Blocage des IP privées/internes
 *  - Fallback via proxies CORS gratuits si accès direct = 403
 *  - Rate limiting dédié (300 req/min/IP)
 */

const config = require('../config')
const { checkRateLimit } = require('../rateLimit')

// ─── USER AGENT ─────────────────────────────────────────────

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// ─── DOMAIN WHITELIST ───────────────────────────────────────

const ALLOWED_DOMAINS = [
  // RT France / RT Global
  'rt-fra.rttv.com',
  'rt-glb.rttv.com',
  'rttv.com',
  'francais.rt.com',
  // PressTV
  'french.presstv.ir',
  'www.presstv.ir',
  'presstv.ir',
  'cdn.presstv.ir',
  // IRNA
  'fr.irna.ir',
  'irna.ir',
  // CDNs courants pour images/médias
  'cdn.jsdelivr.net',
]

// ─── FALLBACK PROXIES ───────────────────────────────────────
// Proxies CORS/HTTP gratuits — essayés en ordre si direct = 403
// Format : URL prefix, l'URL cible est ajoutée encodée après
const FALLBACK_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
]

// ─── MAX RESPONSE (non-streaming) ───────────────────────────

const MAX_RESPONSE_SIZE = 15 * 1024 * 1024 // 15 MB

// ─── HELPERS ────────────────────────────────────────────────

/**
 * Vérifie si un domaine est dans la whitelist
 * Bloque aussi les IP privées/internes (anti-SSRF)
 */
function isDomainAllowed(urlString) {
  try {
    const parsed = new URL(urlString)
    const hostname = parsed.hostname.toLowerCase()

    // Bloquer les protocoles non-HTTP
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return false
    }

    // Bloquer les IP privées / internes
    if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0|localhost|::1|\[::1\])/.test(hostname)) {
      return false
    }

    // Vérifier la whitelist
    return ALLOWED_DOMAINS.some(d =>
      hostname === d || hostname.endsWith('.' + d)
    )
  } catch {
    return false
  }
}

/**
 * Résout une URL relative par rapport à une base
 */
function resolveUrl(base, relative) {
  if (relative.startsWith('http://') || relative.startsWith('https://')) {
    return relative
  }
  try {
    return new URL(relative, base).href
  } catch {
    return relative
  }
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data))
}

// ─── FETCH AVEC FALLBACK ────────────────────────────────────

/**
 * Tente un fetch direct, puis via les proxies CORS si géo-bloqué (403)
 */
async function fetchWithFallback(targetUrl) {
  // 1) Essai direct
  try {
    const resp = await fetch(targetUrl, {
      headers: {
        'User-Agent': UA,
        'Accept': '*/*',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.5',
      },
      signal: AbortSignal.timeout(12000),
      redirect: 'follow'
    })

    // Si pas géo-bloqué, retourner immédiatement
    if (resp.status !== 403) return resp
    console.warn(`[Proxy] Direct fetch 403 for ${targetUrl}, trying fallbacks...`)
  } catch (err) {
    console.warn(`[Proxy] Direct fetch failed for ${targetUrl}: ${err.message}`)
  }

  // 2) Essai via proxies fallback
  for (const proxyPrefix of FALLBACK_PROXIES) {
    try {
      const proxyUrl = proxyPrefix + encodeURIComponent(targetUrl)
      const resp = await fetch(proxyUrl, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(15000),
        redirect: 'follow'
      })

      if (resp.ok || resp.status !== 403) {
        console.log(`[Proxy] Fallback success via ${proxyPrefix.substring(0, 30)}...`)
        return resp
      }
    } catch (err) {
      console.warn(`[Proxy] Fallback failed (${proxyPrefix.substring(0, 25)}): ${err.message}`)
    }
  }

  // 3) Tout a échoué
  throw new Error(`All proxy attempts failed for ${targetUrl}`)
}

// ─── M3U8 REWRITER ──────────────────────────────────────────

/**
 * Réécrit un playlist m3u8 pour router tous les segments via /api/proxy
 */
async function handleM3u8(res, upstream, originalUrl) {
  const body = await upstream.text()
  const baseUrl = new URL('./', originalUrl).href

  const rewritten = body.split('\n').map(line => {
    const trimmed = line.trim()

    // Ligne vide → conserver
    if (!trimmed) return line

    // Ligne #EXT → vérifier si elle contient URI="..."
    if (trimmed.startsWith('#')) {
      if (trimmed.includes('URI="')) {
        return trimmed.replace(/URI="([^"]+)"/g, (_, uri) => {
          const absolute = resolveUrl(baseUrl, uri)
          return `URI="/api/proxy?url=${encodeURIComponent(absolute)}"`
        })
      }
      return line
    }

    // Ligne URL (segment .ts ou sous-playlist .m3u8)
    const absolute = resolveUrl(baseUrl, trimmed)
    return `/api/proxy?url=${encodeURIComponent(absolute)}`
  }).join('\n')

  res.writeHead(200, {
    'Content-Type': 'application/vnd.apple.mpegurl',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache, no-store',
  })
  res.end(rewritten)
}

// ─── HANDLER PRINCIPAL ──────────────────────────────────────

async function handleProxy(req, res, url) {
  // Méthode
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Range',
      'Access-Control-Max-Age': '86400',
    })
    return res.end()
  }

  if (req.method !== 'GET') {
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' })
  }

  // Extraire l'URL cible
  const targetUrl = url.searchParams.get('url')
  if (!targetUrl) {
    return sendJson(res, 400, { ok: false, error: 'Missing url parameter' })
  }

  // Vérifier la whitelist
  if (!isDomainAllowed(targetUrl)) {
    console.warn(`[Proxy] Blocked: ${targetUrl}`)
    return sendJson(res, 403, { ok: false, error: 'Domain not allowed' })
  }

  // Rate limiting
  const clientIp = req.clientIp || req.headers['cf-connecting-ip'] || req.socket.remoteAddress || 'unknown'
  const rl = checkRateLimit('proxy', clientIp,
    config.RATE_LIMIT.PROXY_WINDOW_MS || 60000,
    config.RATE_LIMIT.PROXY_MAX || 300
  )
  if (rl.limited) {
    res.writeHead(429, {
      'Content-Type': 'application/json',
      'Retry-After': Math.ceil(rl.retryAfterMs / 1000).toString()
    })
    return res.end(JSON.stringify({ ok: false, error: 'Too many proxy requests' }))
  }

  try {
    // Fetch avec fallback
    const upstream = await fetchWithFallback(targetUrl)

    // Détecter si c'est un m3u8
    const contentType = upstream.headers.get('content-type') || ''
    const isM3u8 = contentType.includes('mpegurl') ||
                   contentType.includes('m3u8') ||
                   targetUrl.endsWith('.m3u8')

    if (isM3u8) {
      return handleM3u8(res, upstream, targetUrl)
    }

    // Proxy streaming générique (pipe la réponse)
    const headers = {
      'Content-Type': contentType || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Range',
      'Cache-Control': 'no-cache',
    }

    // Conserver Content-Length et Content-Range si présents
    const cl = upstream.headers.get('content-length')
    if (cl) headers['Content-Length'] = cl
    const cr = upstream.headers.get('content-range')
    if (cr) headers['Content-Range'] = cr
    const ar = upstream.headers.get('accept-ranges')
    if (ar) headers['Accept-Ranges'] = ar

    res.writeHead(upstream.status, headers)

    // Pipe le body via ReadableStream
    if (!upstream.body) {
      return res.end()
    }

    const reader = upstream.body.getReader()
    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            res.end()
            break
          }
          // Backpressure : attendre drain si le client est lent
          if (!res.write(value)) {
            await new Promise(resolve => res.once('drain', resolve))
          }
        }
      } catch (err) {
        // Client a fermé la connexion ou erreur réseau
        if (!res.writableEnded) {
          try { res.end() } catch {}
        }
      }
    }

    // Gérer la fermeture client (changement de page, etc.)
    req.on('close', () => {
      try { reader.cancel() } catch {}
    })

    await pump()

  } catch (err) {
    console.error(`[Proxy] Error for ${targetUrl}: ${err.message}`)
    if (!res.headersSent) {
      sendJson(res, 502, { ok: false, error: 'Proxy fetch failed: ' + err.message })
    }
  }
}

module.exports = { handleProxy }
