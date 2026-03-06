const RSSParser = require('rss-parser')
const { translateToFR } = require('./translate')

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

// --- Breaking/Hot News Sources (français) ---
const SOURCES_FR = [
  { name: 'BFMTV', url: 'https://www.bfmtv.com/rss/news-24-7/' },
  { name: 'Euronews', url: 'https://fr.euronews.com/rss' },
  { name: 'France 24', url: 'https://www.france24.com/fr/rss' },
  { name: 'Le Monde', url: 'https://www.lemonde.fr/rss/une.xml' },
  { name: 'RFI', url: 'https://www.rfi.fr/fr/rss' },
  { name: 'RT en français', url: 'https://francais.rt.com/rss' },
  { name: 'PressTV FR', url: 'https://french.presstv.ir/rss.xml' },
  { name: 'IRNA FR', url: 'https://fr.irna.ir/rss' },
]

// --- Sources anglaises (traduction automatique) ---
const SOURCES_EN = [
  { name: 'PressTV', url: 'https://www.presstv.ir/rss/rss-101.xml', lang: 'en' },
]

// --- In-memory cache ---
let breakingCache = null
const CACHE_TTL_MS = 2 * 60 * 1000 // 2 minutes (fast refresh)

// --- Fetch a single FR feed (no translation) ---
async function fetchFeedFR({ name, url }) {
  try {
    const feed = await parser.parseURL(url)
    return feed.items.slice(0, 10).map(item => {
      let pubDate = item.pubDate ? new Date(item.pubDate) : (item.isoDate ? new Date(item.isoDate) : null)
      if (!pubDate || isNaN(pubDate.getTime())) pubDate = new Date(Date.now() - 3 * 60 * 60 * 1000) // fallback: 3h ago

      // Extract image
      let image = null
      if (item.enclosure && item.enclosure.url) {
        image = item.enclosure.url
      } else if (item['media:thumbnail'] && item['media:thumbnail'].$) {
        image = item['media:thumbnail'].$.url
      } else if (item['media:content'] && item['media:content'].$) {
        image = item['media:content'].$.url
      }
      if (!image) image = extractImageFromContent(item.content || item['content:encoded'] || '')

      return {
        title: item.title || '(sans titre)',
        url: item.link || '',
        snippet: stripSnippet(item.contentSnippet || item.description || ''),
        source: name,
        pubDate: pubDate.toISOString(),
        pubDateMs: pubDate.getTime(),
        image
      }
    })
  } catch (err) {
    console.error(`[Breaking] Failed to fetch ${name}: ${err.message}`)
    return []
  }
}

// --- Fetch a single EN feed (with translation) ---
async function fetchFeedEN({ name, url, lang }) {
  try {
    const feed = await parser.parseURL(url)
    const items = feed.items.slice(0, 8) // limiter les appels traduction
    const articles = []

    for (const item of items) {
      let pubDate = item.pubDate ? new Date(item.pubDate) : (item.isoDate ? new Date(item.isoDate) : null)
      if (!pubDate || isNaN(pubDate.getTime())) pubDate = new Date(Date.now() - 3 * 60 * 60 * 1000)

      // Extract image
      let image = null
      if (item.enclosure && item.enclosure.url) {
        image = item.enclosure.url
      } else if (item['media:thumbnail'] && item['media:thumbnail'].$) {
        image = item['media:thumbnail'].$.url
      } else if (item['media:content'] && item['media:content'].$) {
        image = item['media:content'].$.url
      }
      if (!image) {
        let content = item.content || item['content:encoded'] || ''
        if (typeof content !== 'string') {
          content = content._ || content.$t || ''
          if (typeof content !== 'string') content = ''
        }
        image = extractImageFromContent(content)
      }

      // Traduire titre + snippet
      const rawTitle = item.title || ''
      const rawSnippet = stripSnippet(item.contentSnippet || item.description || '')

      const [title, snippet] = await Promise.all([
        translateToFR(rawTitle, lang),
        rawSnippet.length > 10 ? translateToFR(rawSnippet, lang) : Promise.resolve(rawSnippet)
      ])

      articles.push({
        title,
        url: item.link || '',
        snippet,
        source: name,
        pubDate: pubDate.toISOString(),
        pubDateMs: pubDate.getTime(),
        image
      })
    }

    return articles
  } catch (err) {
    console.error(`[Breaking] Failed to fetch ${name}: ${err.message}`)
    return []
  }
}

function extractImageFromContent(html) {
  if (!html || typeof html !== 'string') return null
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/)
  return match ? match[1] : null
}

function stripSnippet(text) {
  if (!text) return ''
  if (typeof text !== 'string') {
    if (text._ || text.$t) return stripSnippet(text._ || text.$t)
    return ''
  }
  return text.replace(/<[^>]*>/g, '').substring(0, 160).replace(/\s+/g, ' ').trim()
}

// --- Fetch all breaking news ---
async function fetchBreaking() {
  // Fetch FR and EN feeds in parallel
  const [frResults, enResults] = await Promise.all([
    Promise.allSettled(SOURCES_FR.map(feed => fetchFeedFR(feed))),
    Promise.allSettled(SOURCES_EN.map(feed => fetchFeedEN(feed)))
  ])

  const articles = []
  const allResults = [...frResults, ...enResults]
  const allSources = [...SOURCES_FR, ...SOURCES_EN]
  for (let i = 0; i < allResults.length; i++) {
    const result = allResults[i]
    const src = allSources[i]?.name || 'unknown'
    if (result.status === 'fulfilled') {
      const imgs = result.value.filter(a => a.image).length
      console.log(`[Breaking] ${src}: ${result.value.length} articles (${imgs} with images)`)
      articles.push(...result.value)
    } else {
      console.warn(`[Breaking] ${src}: REJECTED -`, result.reason?.message || result.reason)
    }
  }

  // Sort by date, newest first — only last 6 hours count as "hot"
  const sixHoursAgo = Date.now() - (6 * 60 * 60 * 1000)
  const hot = articles
    .filter(a => a.pubDateMs > sixHoursAgo)
    .sort((a, b) => b.pubDateMs - a.pubDateMs)

  // Deduplicate by similar titles (remove near-duplicates from different sources)
  const seen = new Set()
  const deduped = []
  for (const article of hot) {
    const key = article.title.toLowerCase().replace(/[^a-zà-ÿ0-9]/g, '').substring(0, 40)
    if (!seen.has(key)) {
      seen.add(key)
      deduped.push(article)
    }
  }

  // Diversifier les sources : max 5 articles par source
  const MAX_PER_SOURCE = 5
  const sourceCounts = {}
  const diverse = []
  const overflow = []
  for (const article of deduped) {
    const src = article.source
    sourceCounts[src] = (sourceCounts[src] || 0) + 1
    if (sourceCounts[src] <= MAX_PER_SOURCE) {
      diverse.push(article)
    } else {
      overflow.push(article) // garder au cas où on n'a pas assez
    }
  }

  // Compléter avec les overflow si < 20
  const result = diverse.slice(0, 20)
  if (result.length < 20) {
    result.push(...overflow.slice(0, 20 - result.length))
  }

  return result
}

// --- Route handler ---
async function handleBreaking(req, res) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' })
  }

  try {
    const now = Date.now()

    // Serve from cache if fresh
    if (breakingCache && (now - breakingCache.fetchedAt) < CACHE_TTL_MS) {
      return sendJson(res, 200, { ok: true, articles: breakingCache.articles, cached: true })
    }

    // Fetch fresh
    const articles = await fetchBreaking()

    if (articles.length === 0 && breakingCache) {
      return sendJson(res, 200, { ok: true, articles: breakingCache.articles, stale: true })
    }

    if (articles.length > 0) {
      breakingCache = { articles, fetchedAt: now }
    }

    sendJson(res, 200, { ok: true, articles })
  } catch (err) {
    console.error('[Breaking] Error:', err.message)
    if (breakingCache) {
      return sendJson(res, 200, { ok: true, articles: breakingCache.articles, stale: true })
    }
    sendJson(res, 500, { ok: false, error: 'Erreur lors de la recuperation des actualites' })
  }
}

// --- Warm cache on startup ---
async function warmBreaking() {
  console.log('[Breaking] Warming breaking news cache...')
  try {
    const articles = await fetchBreaking()
    if (articles.length > 0) {
      breakingCache = { articles, fetchedAt: Date.now() }
      console.log(`[Breaking] ${articles.length} hot articles cached`)
    }
  } catch (err) {
    console.error(`[Breaking] Failed to warm: ${err.message}`)
  }
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data))
}

module.exports = { handleBreaking, warmBreaking }
