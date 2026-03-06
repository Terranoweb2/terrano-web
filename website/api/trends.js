// =====================================================================
// TerranoWeb — Tendances (Google Trends + Brave Trending)
// =====================================================================

const config = require('../config')
const BRAVE_API_KEY = config.BRAVE_API_KEY

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// Cache
let trendsCache = null
const CACHE_TTL = 15 * 60 * 1000 // 15 minutes

// --- Fetch Google Trends RSS (France) ---
async function fetchGoogleTrends() {
  try {
    const resp = await fetch('https://trends.google.com/trending/rss?geo=FR', {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(8000)
    })
    if (!resp.ok) throw new Error(`Google Trends ${resp.status}`)
    const xml = await resp.text()

    const items = []
    const itemRegex = /<item>([\s\S]*?)<\/item>/g
    let match
    while ((match = itemRegex.exec(xml)) && items.length < 15) {
      const block = match[1]
      const title = extractTag(block, 'title')
      const traffic = extractTag(block, 'ht:approx_traffic') || ''
      const newsUrl = extractTag(block, 'ht:news_item_url') || extractTag(block, 'link')
      const picture = extractTag(block, 'ht:picture') || null

      if (!title) continue

      items.push({
        title: decodeHtmlEntities(title),
        traffic: traffic.replace(/[+,]/g, '').trim(),
        url: newsUrl,
        picture
      })
    }
    return items
  } catch (err) {
    console.error('[Trends] Google Trends failed:', err.message)
    return []
  }
}

// --- Fetch Brave Trending (fallback) ---
async function fetchBraveTrending() {
  if (!BRAVE_API_KEY) return []
  try {
    const resp = await fetch('https://api.search.brave.com/res/v1/web/search?q=actualit%C3%A9s+du+jour&count=10&search_lang=fr', {
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': BRAVE_API_KEY
      },
      signal: AbortSignal.timeout(8000)
    })
    if (!resp.ok) throw new Error(`Brave ${resp.status}`)
    const data = await resp.json()

    // Extract query suggestions if available
    const suggestions = (data.query?.suggested || []).slice(0, 8)
    return suggestions.map(s => ({
      title: s,
      traffic: '',
      url: null,
      picture: null
    }))
  } catch (err) {
    console.error('[Trends] Brave trending failed:', err.message)
    return []
  }
}

// --- Route handler ---
async function handleTrends(req, res) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' })
  }

  const now = Date.now()
  if (trendsCache && (now - trendsCache.ts) < CACHE_TTL) {
    return sendJson(res, 200, { ok: true, trends: trendsCache.data, cached: true })
  }

  try {
    let trends = await fetchGoogleTrends()

    // Fallback to Brave if Google Trends returns nothing
    if (trends.length === 0) {
      trends = await fetchBraveTrending()
    }

    if (trends.length > 0) {
      trendsCache = { data: trends, ts: now }
    }

    sendJson(res, 200, { ok: true, trends: trends.length > 0 ? trends : (trendsCache?.data || []) })
  } catch (err) {
    console.error('[Trends] Error:', err.message)
    if (trendsCache) {
      return sendJson(res, 200, { ok: true, trends: trendsCache.data, stale: true })
    }
    sendJson(res, 500, { ok: false, error: 'Erreur tendances' })
  }
}

// --- Warm cache ---
async function warmTrendsCache() {
  console.log('[Trends] Warming trends cache...')
  try {
    const trends = await fetchGoogleTrends()
    if (trends.length > 0) {
      trendsCache = { data: trends, ts: Date.now() }
      console.log(`[Trends] ${trends.length} trends cached`)
    } else {
      const brave = await fetchBraveTrending()
      if (brave.length > 0) {
        trendsCache = { data: brave, ts: Date.now() }
        console.log(`[Trends] ${brave.length} trends (Brave) cached`)
      }
    }
  } catch (err) {
    console.error('[Trends] Warm failed:', err.message)
  }
}

// Helpers
function sendJson(res, status, data) {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-cache'
  })
  res.end(body)
}

function extractTag(xml, tag) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = xml.match(new RegExp(`<${escaped}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${escaped}>|<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`))
  return m ? (m[1] || m[2] || '').trim() : ''
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'").replace(/&#x22;/g, '"')
}

module.exports = { handleTrends, warmTrendsCache }
