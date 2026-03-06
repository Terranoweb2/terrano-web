const RSSParser = require('rss-parser')

const parser = new RSSParser({
  timeout: 10000,
  headers: { 'User-Agent': 'TerranoWeb/1.0 (+https://terranoweb.win)' },
  customFields: {
    item: [
      ['media:content', 'media:content', { keepArray: false }],
      ['media:thumbnail', 'media:thumbnail', { keepArray: false }],
      ['media:group', 'media:group', { keepArray: false }]
    ]
  }
})

// --- RSS Feed Registry ---
const FEEDS = {
  mali: [
    { name: 'Studio Tamani', url: 'https://studiotamani.org/feed' },
    { name: 'Journal du Mali', url: 'https://www.journaldumali.com/feed/' },
    { name: 'Bamada.net', url: 'https://bamada.net/feed' },
    { name: 'Sahelien', url: 'https://sahelien.com/feed/' },
  ],
  burkina: [
    { name: 'Burkina24', url: 'https://burkina24.com/feed/' },
    { name: 'Lefaso.net', url: 'https://lefaso.net/spip.php?page=backend' },
    { name: 'WakatSera', url: 'https://www.wakatsera.com/feed/' },
  ],
  niger: [
    { name: 'Tamtaminfo', url: 'https://tamtaminfo.com/feed/' },
    { name: 'Niger Inter', url: 'https://www.nigerinter.com/feed/' },
    { name: 'AirInfo', url: 'https://www.airinfo.org/feed/' },
  ],
  franco: [
    { name: 'RFI Afrique', url: 'https://www.rfi.fr/fr/afrique/rss' },
    { name: 'France 24 Afrique', url: 'https://www.france24.com/fr/afrique/rss' },
    { name: 'Africa News FR', url: 'https://fr.africanews.com/feed/' },
    { name: 'Jeune Afrique', url: 'https://www.jeuneafrique.com/feed/' },
  ]
}

// --- In-memory cache ---
const cache = new Map()
const CACHE_TTL_MS = 2 * 60 * 1000 // 2 minutes — fast refresh

// --- Fetch a single feed ---
async function fetchFeed({ name, url }) {
  try {
    const feed = await parser.parseURL(url)
    return feed.items.slice(0, 15).map(item => {
      let pubDate = item.pubDate ? new Date(item.pubDate) : new Date()
      if (isNaN(pubDate.getTime())) pubDate = new Date()
      return {
        title: item.title || '(sans titre)',
        url: item.link || '',
        snippet: (item.contentSnippet || '').substring(0, 200).replace(/\s+/g, ' ').trim(),
        source: name,
        pubDate: pubDate.toISOString(),
        pubDateMs: pubDate.getTime(),
        image: item.enclosure?.url
          || (item['media:thumbnail']?.$ && item['media:thumbnail'].$.url)
          || (item['media:content']?.$ && item['media:content'].$.url)
          || extractImageFromContent(item.content || item['content:encoded'] || '')
          || null
      }
    })
  } catch (err) {
    console.error(`[News] Failed to fetch ${name} (${url}): ${err.message}`)
    return []
  }
}

// --- Try to extract first image from HTML content ---
function extractImageFromContent(html) {
  if (!html) return null
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/)
  return match ? match[1] : null
}

// --- Fetch all feeds for a tab ---
async function fetchTabNews(tab) {
  const feeds = FEEDS[tab]
  if (!feeds) return []

  const results = await Promise.allSettled(
    feeds.map(feed => fetchFeed(feed))
  )

  const articles = []
  for (const result of results) {
    if (result.status === 'fulfilled') {
      articles.push(...result.value)
    }
  }

  // Sort by date, newest first
  articles.sort((a, b) => b.pubDateMs - a.pubDateMs)
  return articles.slice(0, 30)
}

// --- Route handler ---
async function handleNews(req, res, url) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' })
  }

  const tab = url.searchParams.get('tab') || 'mali'

  if (!FEEDS[tab]) {
    return sendJson(res, 400, { ok: false, error: 'Onglet invalide. Valeurs: mali, burkina, niger, franco' })
  }

  try {
    const now = Date.now()
    const cached = cache.get(tab)

    // Serve from cache if fresh
    if (cached && (now - cached.fetchedAt) < CACHE_TTL_MS) {
      return sendJson(res, 200, { ok: true, articles: cached.articles, cached: true })
    }

    // Fetch fresh data
    const articles = await fetchTabNews(tab)

    if (articles.length === 0 && cached) {
      // Return stale cache rather than empty
      return sendJson(res, 200, { ok: true, articles: cached.articles, stale: true })
    }

    // Update cache
    if (articles.length > 0) {
      cache.set(tab, { articles, fetchedAt: now })
    }

    sendJson(res, 200, { ok: true, articles })
  } catch (err) {
    console.error('[News] Error:', err.message)

    // Fallback to stale cache
    const cached = cache.get(tab)
    if (cached) {
      return sendJson(res, 200, { ok: true, articles: cached.articles, stale: true })
    }

    sendJson(res, 500, { ok: false, error: 'Erreur lors de la recuperation des actualites' })
  }
}

// --- Warm cache on startup ---
async function warmCache() {
  console.log('[News] Warming cache for all tabs...')
  for (const tab of Object.keys(FEEDS)) {
    try {
      const articles = await fetchTabNews(tab)
      if (articles.length > 0) {
        cache.set(tab, { articles, fetchedAt: Date.now() })
        console.log(`[News] ${tab}: ${articles.length} articles cached`)
      }
    } catch (err) {
      console.error(`[News] Failed to warm ${tab}: ${err.message}`)
    }
  }
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data))
}

module.exports = { handleNews, warmCache }
