/**
 * iran-news.js — Actualités Iran traduites en français
 *
 * Sources mixtes :
 *  - Sources françaises (PressTV FR, IRNA FR) → pas de traduction
 *  - Sources anglaises (PressTV EN) → traduction auto FR
 *
 * Traduction via module partagé translate.js
 * Fallback og:image si pas d'image RSS
 * Cache 2 min, warm au démarrage, fallback stale
 */

const RSSParser = require('rss-parser')
const { translateToFR } = require('./translate')

const parser = new RSSParser({
  timeout: 12000,
  headers: { 'User-Agent': 'TerranoWeb/1.0 (+https://terranoweb.win)' }
})

// ─── SOURCES ────────────────────────────────────────────────

const FEEDS_FR = [
  { name: 'PressTV FR',  url: 'https://french.presstv.ir/rss.xml', lang: 'fr' },
  { name: 'IRNA FR',     url: 'https://fr.irna.ir/rss',            lang: 'fr' },
]

const FEEDS_EN = [
  { name: 'PressTV',      url: 'https://www.presstv.ir/rss/rss-101.xml', lang: 'en' },
  { name: 'PressTV World', url: 'https://www.presstv.ir/rss.xml',         lang: 'en' },
]

const ALL_FEEDS = [...FEEDS_FR, ...FEEDS_EN]

// ─── OG:IMAGE SCRAPING ──────────────────────────────────────

const ogCache = new Map()
const OG_CACHE_MAX = 200

/**
 * Scrape la page article pour extraire og:image ou twitter:image
 * Fallback si pas d'image dans le flux RSS
 */
async function fetchOgImage(articleUrl) {
  if (!articleUrl) return null

  // Check cache
  if (ogCache.has(articleUrl)) return ogCache.get(articleUrl)

  // Normaliser URL (presstv.ir → www.presstv.ir pour éviter les redirects lents)
  let fetchUrl = articleUrl
  if (fetchUrl.includes('://presstv.ir/')) {
    fetchUrl = fetchUrl.replace('://presstv.ir/', '://www.presstv.ir/')
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12000)

    const resp = await fetch(fetchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: controller.signal,
      redirect: 'follow'
    })
    clearTimeout(timeout)

    if (!resp.ok) return null

    const html = await resp.text()

    // Chercher og:image (guillemets simples ou doubles)
    let match = html.match(/<meta[^>]+property=['"]og:image['"][^>]+content=['"]([^'"]+)['"][^>]*>/i)
    if (!match) match = html.match(/<meta[^>]+content=['"]([^'"]+)['"][^>]+property=['"]og:image['"][^>]*>/i)
    // Fallback twitter:image
    if (!match) match = html.match(/<meta[^>]+name=['"]twitter:image['"][^>]+content=['"]([^'"]+)['"][^>]*>/i)
    if (!match) match = html.match(/<meta[^>]+content=['"]([^'"]+)['"][^>]+name=['"]twitter:image['"][^>]*>/i)

    const imageUrl = match ? match[1] : null

    // Stocker en cache (avec limite FIFO)
    if (ogCache.size > OG_CACHE_MAX) {
      const firstKey = ogCache.keys().next().value
      ogCache.delete(firstKey)
    }
    ogCache.set(articleUrl, imageUrl)

    return imageUrl
  } catch (err) {
    // Timeout ou erreur réseau — on stocke null pour ne pas re-tenter
    ogCache.set(articleUrl, null)
    return null
  }
}

// ─── IMAGE EXTRACTION ───────────────────────────────────────

function extractImage(item) {
  // Enclosure
  if (item.enclosure && item.enclosure.url) return item.enclosure.url
  // media:content / media:thumbnail
  const mc = item['media:content'] || item['media:thumbnail']
  if (mc) {
    if (typeof mc === 'string') return mc
    if (mc.$ && mc.$.url) return mc.$.url
    if (Array.isArray(mc) && mc[0] && mc[0].$ && mc[0].$.url) return mc[0].$.url
  }
  // content:encoded / content — chercher <img src="">
  let html = item['content:encoded'] || item.content || ''
  if (typeof html !== 'string') {
    html = html._ || html.$t || ''
    if (typeof html !== 'string') html = ''
  }
  if (html) {
    const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i)
    if (imgMatch) return imgMatch[1]
  }
  return null
}

// ─── HTML STRIP ─────────────────────────────────────────────

function stripHTML(html) {
  if (!html) return ''
  // Certains parsers RSS retournent des objets au lieu de strings
  if (typeof html !== 'string') {
    if (html._ || html.$t) return stripHTML(html._ || html.$t)
    try { return stripHTML(JSON.stringify(html)) } catch { return '' }
  }
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── FEED FETCHING ──────────────────────────────────────────

async function fetchFeed(feed) {
  try {
    const data = await parser.parseURL(feed.url)
    if (!data || !data.items || data.items.length === 0) return []

    const items = data.items.slice(0, 15) // max 15 par feed
    const articles = []

    for (const item of items) {
      const rawTitle = item.title || ''
      const rawSnippet = stripHTML(
        item.contentSnippet || item['content:encoded'] || item.content || item.summary || ''
      ).substring(0, 300)

      let title = rawTitle
      let snippet = rawSnippet.substring(0, 200)

      // Traduire si source anglaise
      if (feed.lang === 'en') {
        const [tTitle, tSnippet] = await Promise.all([
          translateToFR(rawTitle, 'en'),
          rawSnippet.length > 10 ? translateToFR(rawSnippet.substring(0, 200), 'en') : Promise.resolve(rawSnippet)
        ])
        title = tTitle
        snippet = tSnippet
      }

      const pubDate = item.pubDate || item.isoDate || new Date().toISOString()

      // Image : RSS d'abord, sinon null (og:image sera tenté après)
      const rssImage = extractImage(item)

      articles.push({
        title: title,
        url: item.link || '',
        snippet: snippet,
        source: feed.name,
        pubDate: new Date(pubDate).toISOString(),
        pubDateMs: new Date(pubDate).getTime(),
        image: rssImage,
        lang: feed.lang
      })
    }

    return articles
  } catch (err) {
    console.warn(`[Iran] Feed error (${feed.name}):`, err.message)
    return []
  }
}

// ─── CACHE ──────────────────────────────────────────────────

const CACHE_TTL_MS = 2 * 60 * 1000 // 2 minutes
let cache = { articles: null, ts: 0 }

async function fetchAllIranNews() {
  console.log('[Iran] Fetching all feeds...')
  const start = Date.now()

  // Fetch tous les feeds en parallèle
  const results = await Promise.allSettled(ALL_FEEDS.map(f => fetchFeed(f)))

  let allArticles = []
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.length > 0) {
      allArticles.push(...r.value)
    }
  }

  // Trier par date (plus récent en premier)
  allArticles.sort((a, b) => b.pubDateMs - a.pubDateMs)

  // Dédupliquer par titre similaire
  const seen = new Set()
  const unique = []
  for (const a of allArticles) {
    const norm = a.title.toLowerCase().replace(/[^a-zàâéèêëïîôùûüÿçœæ0-9]/g, '').substring(0, 50)
    if (seen.has(norm)) continue
    seen.add(norm)
    unique.push(a)
  }

  // Max 30 articles
  const final = unique.slice(0, 30)

  // Scraper og:image pour les articles sans image (en parallèle, max 10)
  const noImage = final.filter(a => !a.image && a.url)
  if (noImage.length > 0) {
    const batch = noImage.slice(0, 10) // limiter à 10 scrapes max
    const ogResults = await Promise.allSettled(
      batch.map(a => fetchOgImage(a.url))
    )
    for (let i = 0; i < batch.length; i++) {
      if (ogResults[i].status === 'fulfilled' && ogResults[i].value) {
        batch[i].image = ogResults[i].value
      }
    }
  }

  const elapsed = Date.now() - start
  const withImg = final.filter(a => a.image).length
  console.log(`[Iran] ${final.length} articles loaded in ${elapsed}ms (${allArticles.length} raw, ${results.filter(r => r.status === 'fulfilled').length}/${ALL_FEEDS.length} feeds OK, ${withImg} with images)`)

  return final
}

// ─── HANDLER ────────────────────────────────────────────────

async function handleIranNews(req, res) {
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }))
    return
  }

  const now = Date.now()

  // Servir depuis le cache si frais
  if (cache.articles && (now - cache.ts) < CACHE_TTL_MS) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, articles: cache.articles, cached: true }))
    return
  }

  try {
    const articles = await fetchAllIranNews()
    if (articles.length > 0) {
      cache = { articles, ts: now }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      ok: true,
      articles: articles.length > 0 ? articles : (cache.articles || []),
      cached: false,
      stale: articles.length === 0 && cache.articles !== null
    }))
  } catch (err) {
    console.error('[Iran] Handler error:', err)
    // Fallback cache stale
    if (cache.articles) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, articles: cache.articles, cached: true, stale: true }))
    } else {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: 'Erreur lors de la recuperation des actualites Iran' }))
    }
  }
}

// ─── WARM CACHE ─────────────────────────────────────────────

async function warmIranCache() {
  try {
    const articles = await fetchAllIranNews()
    if (articles.length > 0) {
      cache = { articles, ts: Date.now() }
      console.log(`[Iran] Cache warmed: ${articles.length} articles`)
    }
  } catch (err) {
    console.warn('[Iran] Cache warm failed:', err.message)
  }
}

module.exports = { handleIranNews, warmIranCache }
