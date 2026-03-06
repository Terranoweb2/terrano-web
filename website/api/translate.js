/**
 * translate.js — Module de traduction partagé (Google Translate gtx)
 *
 * Utilisé par iran-news.js et breaking.js
 * Cache en mémoire, retry x2, timeout 8s
 */

const transCache = new Map()
const TRANS_CACHE_MAX = 500

/**
 * Traduit un texte vers le français via Google Translate (gratuit)
 * Retry intégré + cache en mémoire
 */
async function translateToFR(text, srcLang = 'en') {
  if (!text || text.length < 3) return text
  if (srcLang === 'fr') return text

  // Check cache
  const cacheKey = text.substring(0, 120)
  if (transCache.has(cacheKey)) return transCache.get(cacheKey)

  // Tronquer les textes trop longs pour l'API
  const input = text.length > 1500 ? text.substring(0, 1500) + '...' : text

  const maxRetries = 2
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const url = 'https://translate.googleapis.com/translate_a/single'
        + '?client=gtx'
        + '&sl=' + encodeURIComponent(srcLang)
        + '&tl=fr'
        + '&dt=t'
        + '&q=' + encodeURIComponent(input)

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)

      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        signal: controller.signal
      })
      clearTimeout(timeout)

      if (!resp.ok) {
        if (attempt < maxRetries) { await sleep(500 * (attempt + 1)); continue }
        return text // fallback texte original
      }

      const data = await resp.json()

      // Reconstruire le texte traduit depuis les segments
      let translated = ''
      if (Array.isArray(data) && Array.isArray(data[0])) {
        for (const seg of data[0]) {
          if (seg && seg[0]) translated += seg[0]
        }
      }

      if (translated && translated.length > 2) {
        // Stocker en cache (avec limite FIFO)
        if (transCache.size > TRANS_CACHE_MAX) {
          const firstKey = transCache.keys().next().value
          transCache.delete(firstKey)
        }
        transCache.set(cacheKey, translated)
        return translated
      }

      return text
    } catch (err) {
      if (attempt < maxRetries) { await sleep(500 * (attempt + 1)); continue }
      console.warn('[Translate] Error:', err.message)
      return text
    }
  }
  return text
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

module.exports = { translateToFR, sleep }
