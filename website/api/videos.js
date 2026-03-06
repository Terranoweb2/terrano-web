// --- YouTube Channels (handle = @username) ---
const YT_CHANNELS = [
  { name: 'France 24', handle: '@FRANCE24' },
  { name: 'africanews FR', handle: '@africanewsfr' },
]

const RT_FEED_URL = 'https://francais.rt.com/rss'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// --- Cache ---
const cache = { rtfr: null, random: null }
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

// --- Fetch RT France RSS ---
async function fetchRTVideos() {
  try {
    const resp = await fetch(RT_FEED_URL, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(10000)
    })
    if (!resp.ok) throw new Error(`RT RSS ${resp.status}`)
    const xml = await resp.text()

    const items = []
    const itemRegex = /<item>([\s\S]*?)<\/item>/g
    let match
    while ((match = itemRegex.exec(xml)) && items.length < 10) {
      const block = match[1]
      const title = extractTag(block, 'title')
      const link = extractTag(block, 'link')
      const pubDateStr = extractTag(block, 'pubDate')
      const enclosure = block.match(/enclosure[^>]*url="([^"]+)"/)
      const thumbnail = enclosure ? enclosure[1] : null

      if (!thumbnail) continue

      let pubDate = pubDateStr ? new Date(pubDateStr) : new Date()
      if (isNaN(pubDate.getTime())) pubDate = new Date()

      items.push({
        title: title || '(sans titre)',
        url: link || '',
        thumbnail,
        source: 'RT en français',
        pubDate: pubDate.toISOString(),
        pubDateMs: pubDate.getTime(),
        type: 'article'
      })
    }
    return items
  } catch (err) {
    console.error('[Videos] Failed to fetch RT France:', err.message)
    return []
  }
}

// --- Scrape YouTube channel videos ---
async function fetchYTVideos() {
  const allVideos = []

  const results = await Promise.allSettled(
    YT_CHANNELS.map(async ({ name, handle }) => {
      try {
        const url = `https://www.youtube.com/${handle}/videos`
        const resp = await fetch(url, {
          headers: { 'User-Agent': UA },
          signal: AbortSignal.timeout(15000)
        })
        if (!resp.ok) throw new Error(`YouTube ${resp.status}`)
        const html = await resp.text()

        // Extract ytInitialData JSON
        const dataMatch = html.match(/var ytInitialData = ({.*?});/)
        if (!dataMatch) throw new Error('No ytInitialData found')
        const data = JSON.parse(dataMatch[1])

        // Navigate to video list
        const tabs = data?.contents?.twoColumnBrowseResultsRenderer?.tabs || []
        const videosTab = tabs.find(t => t.tabRenderer?.content?.richGridRenderer)
        if (!videosTab) throw new Error('No videos tab')

        const gridItems = videosTab.tabRenderer.content.richGridRenderer.contents || []
        const videos = []

        for (const item of gridItems) {
          if (videos.length >= 8) break
          const vid = item.richItemRenderer?.content?.videoRenderer
          if (!vid || !vid.videoId) continue

          const title = vid.title?.runs?.[0]?.text || '(sans titre)'
          const videoId = vid.videoId
          const publishedText = vid.publishedTimeText?.simpleText || ''

          // Estimate pubDate from relative text
          const pubDate = estimateDate(publishedText)

          videos.push({
            title,
            url: `https://www.youtube.com/watch?v=${videoId}`,
            videoId,
            thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            source: name,
            pubDate: pubDate.toISOString(),
            pubDateMs: pubDate.getTime(),
            type: 'youtube'
          })
        }

        console.log(`[Videos] ${name}: ${videos.length} videos scraped`)
        return videos
      } catch (err) {
        console.error(`[Videos] Failed to fetch ${name}: ${err.message}`)
        return []
      }
    })
  )

  for (const result of results) {
    if (result.status === 'fulfilled') {
      allVideos.push(...result.value)
    }
  }

  // Sort by date, newest first
  allVideos.sort((a, b) => b.pubDateMs - a.pubDateMs)
  return allVideos.slice(0, 15)
}

// Estimate a Date from YouTube's relative time text (e.g. "19 minutes ago", "il y a 3 heures")
function estimateDate(text) {
  if (!text) return new Date()
  const now = Date.now()
  const t = text.toLowerCase()

  // English patterns
  let m = t.match(/(\d+)\s*minute/)
  if (m) return new Date(now - parseInt(m[1]) * 60000)
  m = t.match(/(\d+)\s*hour/)
  if (m) return new Date(now - parseInt(m[1]) * 3600000)
  m = t.match(/(\d+)\s*day/)
  if (m) return new Date(now - parseInt(m[1]) * 86400000)
  m = t.match(/(\d+)\s*week/)
  if (m) return new Date(now - parseInt(m[1]) * 604800000)
  m = t.match(/(\d+)\s*month/)
  if (m) return new Date(now - parseInt(m[1]) * 2592000000)

  // French patterns (il y a X heures/jours...)
  m = t.match(/(\d+)\s*minute/)
  if (m) return new Date(now - parseInt(m[1]) * 60000)
  m = t.match(/(\d+)\s*heure/)
  if (m) return new Date(now - parseInt(m[1]) * 3600000)
  m = t.match(/(\d+)\s*jour/)
  if (m) return new Date(now - parseInt(m[1]) * 86400000)
  m = t.match(/(\d+)\s*semaine/)
  if (m) return new Date(now - parseInt(m[1]) * 604800000)
  m = t.match(/(\d+)\s*mois/)
  if (m) return new Date(now - parseInt(m[1]) * 2592000000)

  return new Date()
}

// Extract text from XML tag
function extractTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))
  return m ? (m[1] || m[2] || '').trim() : ''
}

// --- Route handler ---
async function handleVideos(req, res, url) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' })
  }

  const side = url.searchParams.get('side') // 'rtfr' or 'random'

  try {
    const now = Date.now()

    if (side === 'rtfr') {
      const cached = cache.rtfr
      if (cached && (now - cached.fetchedAt) < CACHE_TTL_MS) {
        return sendJson(res, 200, { ok: true, videos: cached.videos })
      }
      const videos = await fetchRTVideos()
      if (videos.length > 0) {
        cache.rtfr = { videos, fetchedAt: now }
      }
      sendJson(res, 200, { ok: true, videos: videos.length > 0 ? videos : (cached?.videos || []) })
    } else {
      // random — YouTube videos
      const cached = cache.random
      if (cached && (now - cached.fetchedAt) < CACHE_TTL_MS) {
        return sendJson(res, 200, { ok: true, videos: cached.videos })
      }
      const videos = await fetchYTVideos()
      if (videos.length > 0) {
        cache.random = { videos, fetchedAt: now }
      }
      sendJson(res, 200, { ok: true, videos: videos.length > 0 ? videos : (cached?.videos || []) })
    }
  } catch (err) {
    console.error('[Videos] Error:', err.message)
    const fallback = cache[side === 'rtfr' ? 'rtfr' : 'random']
    if (fallback) {
      return sendJson(res, 200, { ok: true, videos: fallback.videos, stale: true })
    }
    sendJson(res, 500, { ok: false, error: 'Erreur lors de la recuperation des videos' })
  }
}

// --- Warm cache ---
async function warmVideoCache() {
  console.log('[Videos] Warming video cache...')
  try {
    const rtVideos = await fetchRTVideos()
    if (rtVideos.length > 0) {
      cache.rtfr = { videos: rtVideos, fetchedAt: Date.now() }
      console.log(`[Videos] RT France: ${rtVideos.length} items cached`)
    }
  } catch (err) {
    console.error('[Videos] Failed to warm RT cache:', err.message)
  }
  try {
    const ytVideos = await fetchYTVideos()
    if (ytVideos.length > 0) {
      cache.random = { videos: ytVideos, fetchedAt: Date.now() }
      console.log(`[Videos] YouTube: ${ytVideos.length} videos cached`)
    }
  } catch (err) {
    console.error('[Videos] Failed to warm YT cache:', err.message)
  }
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data))
}

module.exports = { handleVideos, warmVideoCache }
