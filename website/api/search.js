const cheerio = require('cheerio')
const config = require('../config')

const BRAVE_API_KEY = config.BRAVE_API_KEY
const BRAVE_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search'
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const MAX_CACHE_SIZE = 100

const cache = new Map()

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
]

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

// =====================================================================
// 1. Startpage (primary — Google proxy, reliable, French results, free)
// =====================================================================
async function searchStartpage(query) {
  try {
    const body = new URLSearchParams({ query, cat: 'web', language: 'francais' })
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12000)

    const response = await fetch('https://www.startpage.com/sp/search', {
      method: 'POST',
      headers: {
        'User-Agent': randomUA(),
        'Accept': 'text/html,application/xhtml+xml',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.5'
      },
      body: body.toString(),
      signal: controller.signal
    })
    clearTimeout(timeout)

    if (!response.ok) throw new Error(`Startpage HTTP ${response.status}`)
    const html = await response.text()
    const $ = cheerio.load(html)
    const results = []

    $('div.result').each((i, el) => {
      const titleLink = $(el).find('a.result-title')
      const title = titleLink.text().trim()
      const url = titleLink.attr('href') || ''

      // Skip CSS-only or invalid titles
      if (!title || title.startsWith('.css-') || title.startsWith('{') || !url.startsWith('http')) return

      // Description
      const desc = $(el).find('p.description, .result-description, p').first().text().trim()

      const domain = extractDomain(url)
      results.push({
        title: stripHtml(title),
        url,
        description: stripHtml(desc).substring(0, 300),
        source: domain,
        favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
      })
    })

    if (results.length === 0) return null
    console.log(`[Search] Startpage: ${results.length} results for "${query}"`)
    return results.slice(0, 15)
  } catch (err) {
    console.error('[Search] Startpage failed:', err.message)
    return null
  }
}

// =====================================================================
// 2. DuckDuckGo HTML (backup)
// =====================================================================
async function searchDDGHtml(query) {
  try {
    const params = new URLSearchParams({ q: query, kl: 'fr-fr', kp: '-1' })
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12000)

    const response = await fetch(`https://html.duckduckgo.com/html/?${params}`, {
      headers: {
        'User-Agent': randomUA(),
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.5'
      },
      signal: controller.signal
    })
    clearTimeout(timeout)

    // DDG returns 202 for bot detection
    if (response.status === 202) return null
    if (!response.ok) throw new Error(`DDG HTML ${response.status}`)

    const html = await response.text()
    if (html.includes('bots use DuckDuckGo')) return null

    const $ = cheerio.load(html)
    const results = []

    $('.result').each((i, el) => {
      const a = $(el).find('.result__a')
      const title = a.text().trim()
      const rawHref = a.attr('href') || ''

      let url = rawHref
      try {
        if (rawHref.includes('uddg=')) {
          const u = new URL(rawHref.startsWith('//') ? 'https:' + rawHref : rawHref)
          url = decodeURIComponent(u.searchParams.get('uddg') || rawHref)
        }
      } catch {}

      const desc = $(el).find('.result__snippet').text().trim()

      if (title && url && url.startsWith('http')) {
        const domain = extractDomain(url)
        results.push({
          title: stripHtml(title),
          url,
          description: stripHtml(desc),
          source: domain,
          favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
        })
      }
    })

    if (results.length === 0) return null
    console.log(`[Search] DDG HTML: ${results.length} results for "${query}"`)
    return results.slice(0, 15)
  } catch (err) {
    console.error('[Search] DDG HTML failed:', err.message)
    return null
  }
}

// =====================================================================
// 3. Bing Web Scraping (backup)
// =====================================================================
function decodeBingUrl(bingUrl) {
  try {
    const u = new URL(bingUrl)
    const encoded = u.searchParams.get('u')
    if (encoded && encoded.startsWith('a1')) {
      return Buffer.from(encoded.substring(2), 'base64').toString('utf-8')
    }
    if (!bingUrl.includes('bing.com/ck/a')) return bingUrl
  } catch {}
  return bingUrl
}

async function searchBing(query) {
  try {
    const params = new URLSearchParams({
      q: query, setlang: 'fr', cc: 'FR', mkt: 'fr-FR', count: '20'
    })
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(`https://www.bing.com/search?${params}`, {
      headers: {
        'User-Agent': randomUA(),
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.5'
      },
      redirect: 'follow',
      signal: controller.signal
    })
    clearTimeout(timeout)

    if (!response.ok) throw new Error(`Bing HTTP ${response.status}`)
    const html = await response.text()
    const $ = cheerio.load(html)
    const results = []

    $('li.b_algo').each((i, el) => {
      const a = $(el).find('h2 a')
      const title = a.text().trim()
      const rawUrl = a.attr('href') || ''
      const url = decodeBingUrl(rawUrl)
      const desc = $(el).find('.b_caption p').first().text().trim()
        || $(el).find('.b_lineclamp2').first().text().trim()
        || $(el).find('.b_lineclamp3').first().text().trim()
        || ''
      if (title && url && url.startsWith('http')) {
        const domain = extractDomain(url)
        results.push({
          title: stripHtml(title),
          url,
          description: stripHtml(desc),
          source: domain,
          favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
        })
      }
    })

    if (results.length === 0) return null
    console.log(`[Search] Bing: ${results.length} results for "${query}"`)
    return results.slice(0, 15)
  } catch (err) {
    console.error('[Search] Bing failed:', err.message)
    return null
  }
}

// =====================================================================
// 4. Brave Search API (premium fallback, needs BRAVE_SEARCH_KEY)
// =====================================================================
async function searchBrave(query) {
  if (!BRAVE_API_KEY) return null
  try {
    const params = new URLSearchParams({
      q: query, count: '15', search_lang: 'fr', result_filter: 'web'
    })
    const response = await fetch(`${BRAVE_ENDPOINT}?${params}`, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': BRAVE_API_KEY
      }
    })
    if (!response.ok) throw new Error(`Brave API ${response.status}`)
    const data = await response.json()
    const web = data.web?.results || []
    return web.slice(0, 15).map(r => ({
      title: stripHtml(r.title || ''),
      url: r.url || '',
      description: stripHtml(r.description || ''),
      source: extractDomain(r.url),
      age: r.age || null,
      favicon: r.profile?.img || `https://www.google.com/s2/favicons?domain=${extractDomain(r.url)}&sz=32`
    }))
  } catch (err) {
    console.error('[Search] Brave failed:', err.message)
    return null
  }
}

// =====================================================================
// 5. Brave Image Search API
// =====================================================================
async function searchBraveImages(query) {
  if (!BRAVE_API_KEY) return null
  try {
    const params = new URLSearchParams({
      q: query, count: '30', search_lang: 'fr'
    })
    const response = await fetch(`https://api.search.brave.com/res/v1/images/search?${params}`, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': BRAVE_API_KEY
      }
    })
    if (!response.ok) throw new Error(`Brave Images API ${response.status}`)
    const data = await response.json()
    const images = data.results || []
    return images.slice(0, 30).map(r => ({
      title: stripHtml(r.title || ''),
      url: r.url || '',
      source: r.source || extractDomain(r.url),
      pageUrl: r.page_url || r.url || '',
      thumbnail: r.thumbnail?.src || '',
      width: r.properties?.width || r.width || 0,
      height: r.properties?.height || r.height || 0
    }))
  } catch (err) {
    console.error('[Search] Brave Images failed:', err.message)
    return null
  }
}

// =====================================================================
// 6. Brave Video Search API
// =====================================================================
async function searchBraveVideos(query) {
  if (!BRAVE_API_KEY) return null
  try {
    const params = new URLSearchParams({
      q: query, count: '20', search_lang: 'fr'
    })
    const response = await fetch(`https://api.search.brave.com/res/v1/videos/search?${params}`, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': BRAVE_API_KEY
      }
    })
    if (!response.ok) throw new Error(`Brave Videos API ${response.status}`)
    const data = await response.json()
    const videos = data.results || []
    return videos.slice(0, 20).map(r => ({
      title: stripHtml(r.title || ''),
      url: r.url || '',
      description: stripHtml(r.description || ''),
      source: extractDomain(r.url),
      thumbnail: r.thumbnail?.src || '',
      age: r.age || '',
      duration: r.video?.duration || '',
      creator: r.meta_url?.hostname || extractDomain(r.url),
      views: r.video?.views || null
    }))
  } catch (err) {
    console.error('[Search] Brave Videos failed:', err.message)
    return null
  }
}

// =====================================================================
// Helpers
// =====================================================================
function extractDomain(url) {
  try { return new URL(url).hostname.replace('www.', '') } catch { return '' }
}

function stripHtml(str) {
  return str
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'").replace(/&#x22;/g, '"')
    .trim()
}

function evictCache() {
  if (cache.size <= MAX_CACHE_SIZE) return
  const oldest = [...cache.entries()].sort((a, b) => a[1].fetchedAt - b[1].fetchedAt)
  while (cache.size > MAX_CACHE_SIZE * 0.8) {
    const [key] = oldest.shift()
    cache.delete(key)
  }
}

// =====================================================================
// Route handler
// =====================================================================
async function handleSearch(req, res, url) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' })
  }

  const query = (url.searchParams.get('q') || '').trim()
  if (!query) {
    return sendJson(res, 400, { ok: false, error: 'Requete de recherche vide' })
  }
  if (query.length > 200) {
    return sendJson(res, 400, { ok: false, error: 'Requete trop longue' })
  }

  const cacheKey = query.toLowerCase()
  const now = Date.now()
  const cached = cache.get(cacheKey)

  // Serve from cache if fresh
  if (cached && (now - cached.fetchedAt) < CACHE_TTL_MS) {
    return sendJson(res, 200, {
      ok: true, results: cached.results,
      query, provider: cached.provider, cached: true
    })
  }

  try {
    // Priority: Brave API (fast, reliable) → Startpage → DDG HTML → Bing
    let results = await searchBrave(query)
    let provider = 'brave'

    if (!results || results.length === 0) {
      results = await searchStartpage(query)
      provider = 'startpage'
    }

    if (!results || results.length === 0) {
      results = await searchDDGHtml(query)
      provider = 'duckduckgo'
    }

    if (!results || results.length === 0) {
      results = await searchBing(query)
      provider = 'bing'
    }

    if (!results || results.length === 0) {
      if (cached) {
        return sendJson(res, 200, {
          ok: true, results: cached.results,
          query, provider: cached.provider, stale: true
        })
      }
      return sendJson(res, 200, { ok: true, results: [], query })
    }

    // Update cache
    cache.set(cacheKey, { results, fetchedAt: now, provider })
    evictCache()

    sendJson(res, 200, { ok: true, results, query, provider })
  } catch (err) {
    console.error('[Search] Error:', err.message)
    if (cached) {
      return sendJson(res, 200, {
        ok: true, results: cached.results,
        query, provider: cached.provider, stale: true
      })
    }
    sendJson(res, 500, { ok: false, error: 'Erreur lors de la recherche' })
  }
}

// =====================================================================
// Image search route handler
// =====================================================================
async function handleSearchImages(req, res, url) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' })
  }
  const query = (url.searchParams.get('q') || '').trim()
  if (!query) return sendJson(res, 400, { ok: false, error: 'Requete vide' })
  if (query.length > config.MAX_SEARCH_QUERY) {
    return sendJson(res, 400, { ok: false, error: 'Requete trop longue' })
  }

  const cacheKey = 'img:' + query.toLowerCase()
  const now = Date.now()
  const cached = cache.get(cacheKey)
  if (cached && (now - cached.fetchedAt) < CACHE_TTL_MS) {
    return sendJson(res, 200, { ok: true, results: cached.results, query, cached: true })
  }

  try {
    const results = await searchBraveImages(query)
    if (results && results.length > 0) {
      cache.set(cacheKey, { results, fetchedAt: now })
      evictCache()
      return sendJson(res, 200, { ok: true, results, query })
    }
    if (cached) return sendJson(res, 200, { ok: true, results: cached.results, query, stale: true })
    sendJson(res, 200, { ok: true, results: [], query })
  } catch (err) {
    console.error('[Search Images] Error:', err.message)
    if (cached) return sendJson(res, 200, { ok: true, results: cached.results, query, stale: true })
    sendJson(res, 500, { ok: false, error: 'Erreur recherche images' })
  }
}

// =====================================================================
// Video search route handler
// =====================================================================
async function handleSearchVideos(req, res, url) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' })
  }
  const query = (url.searchParams.get('q') || '').trim()
  if (!query) return sendJson(res, 400, { ok: false, error: 'Requete vide' })
  if (query.length > config.MAX_SEARCH_QUERY) {
    return sendJson(res, 400, { ok: false, error: 'Requete trop longue' })
  }

  const cacheKey = 'vid:' + query.toLowerCase()
  const now = Date.now()
  const cached = cache.get(cacheKey)
  if (cached && (now - cached.fetchedAt) < CACHE_TTL_MS) {
    return sendJson(res, 200, { ok: true, results: cached.results, query, cached: true })
  }

  try {
    const results = await searchBraveVideos(query)
    if (results && results.length > 0) {
      cache.set(cacheKey, { results, fetchedAt: now })
      evictCache()
      return sendJson(res, 200, { ok: true, results, query })
    }
    if (cached) return sendJson(res, 200, { ok: true, results: cached.results, query, stale: true })
    sendJson(res, 200, { ok: true, results: [], query })
  } catch (err) {
    console.error('[Search Videos] Error:', err.message)
    if (cached) return sendJson(res, 200, { ok: true, results: cached.results, query, stale: true })
    sendJson(res, 500, { ok: false, error: 'Erreur recherche videos' })
  }
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data))
}

module.exports = { handleSearch, handleSearchImages, handleSearchVideos }
