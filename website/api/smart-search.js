// =====================================================================
// TerranoWeb — Recherche Intelligente
// Détection d'entités + Wikipedia + Wikidata + DDG Instant Answer
// =====================================================================
const config = require('../config')

const BRAVE_API_KEY = config.BRAVE_API_KEY
const BRAVE_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search'

// Cache
const smartCache = new Map()
const SMART_CACHE_TTL = 5 * 60 * 1000
const MAX_SMART_CACHE = 50

const wikiCache = new Map()
const WIKI_CACHE_TTL = 30 * 60 * 1000

// =====================================================================
// 1. Entity Detection (heuristic, no network)
// =====================================================================
function detectEntityType(query) {
  const q = query.trim()
  const words = q.split(/\s+/)
  const qLower = q.toLowerCase()

  // --- Person detection ---
  const personPrefixes = [
    'dr', 'dr.', 'prof', 'prof.', 'mr', 'mr.', 'mrs', 'mrs.',
    'ms', 'ms.', 'miss', 'sir', 'dame', 'lord', 'lady',
    'president', 'président', 'ministre', 'general', 'général',
    'colonel', 'capitaine', 'imam', 'sheikh', 'cheikh',
    'maître', 'maitre', 'docteur', 'professeur',
    'monsieur', 'madame', 'mademoiselle', 'mlle', 'mme'
  ]
  const firstWordLower = words[0].toLowerCase().replace(/\.$/, '')
  if (personPrefixes.includes(firstWordLower) && words.length >= 2) {
    return 'person'
  }

  // "who is" / "qui est" patterns
  if (/^(who\s+is|qui\s+est|biograph)/i.test(qLower)) return 'person'

  // Capitalized multi-word names (2-4 words, all capitalized)
  const commonWords = new Set([
    'the', 'of', 'in', 'at', 'on', 'for', 'and', 'or', 'to', 'is', 'a',
    'le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'en', 'au', 'aux',
    'how', 'what', 'where', 'when', 'why', 'who', 'which', 'do', 'does',
    'comment', 'quoi', 'quel', 'quelle', 'quand', 'pourquoi', 'ou', 'est'
  ])
  const significantWords = words.filter(w => !commonWords.has(w.toLowerCase()))
  if (significantWords.length >= 2 && significantWords.length <= 4) {
    const allCapitalized = significantWords.every(w => /^[A-ZÀ-Ÿ]/.test(w))
    if (allCapitalized) return 'person_or_place'
  }

  // --- Place detection ---
  const placeKeywords = [
    'city', 'country', 'ville', 'pays', 'capital', 'capitale',
    'island', 'ile', 'île', 'mountain', 'montagne', 'river',
    'fleuve', 'rivière', 'ocean', 'océan', 'lac', 'lake',
    'region', 'région', 'province', 'state', 'état', 'continent'
  ]
  if (placeKeywords.some(k => qLower.includes(k))) return 'place'

  // --- Company detection ---
  const companyKeywords = [
    'inc', 'inc.', 'corp', 'corp.', 'ltd', 'ltd.', 'llc',
    'sarl', 'sa', 'gmbh', 'company', 'entreprise', 'startup',
    'société', 'societe', 'group', 'groupe', 'holdings'
  ]
  const lastWord = words[words.length - 1].toLowerCase().replace(/\.$/, '')
  if (companyKeywords.includes(lastWord)) return 'company'

  // Single capitalized word (possible entity)
  if (words.length === 1 && /^[A-ZÀ-Ÿ]/.test(q) && q.length > 2) {
    return 'concept'
  }

  return 'general'
}

// =====================================================================
// 2. Refine entity type using Wikipedia categories
// =====================================================================
function refineEntityType(initialType, wikiCategories) {
  if (!wikiCategories || wikiCategories.length === 0) return initialType
  const catStr = wikiCategories.join(' ').toLowerCase()

  const personCats = [
    'birth', 'death', 'people', 'naissance', 'décès', 'personnalité',
    'alumni', 'sportif', 'joueur', 'acteur', 'actrice', 'chanteur',
    'chanteuse', 'politician', 'scientist', 'writer', 'artiste',
    'musicien', 'musicienne', 'living people', 'homme politique',
    'femme politique', 'médecin', 'avocat', 'ingénieur'
  ]
  if (personCats.some(c => catStr.includes(c))) return 'person'

  const placeCats = [
    'city', 'country', 'commune', 'ville', 'région', 'geography',
    'municipality', 'populated place', 'capital', 'préfecture',
    'continent', 'pays'
  ]
  if (placeCats.some(c => catStr.includes(c))) return 'place'

  const companyCats = [
    'company', 'entreprise', 'société', 'brand', 'corporation',
    'organization', 'organisation', 'founded in'
  ]
  if (companyCats.some(c => catStr.includes(c))) return 'company'

  return initialType === 'person_or_place' ? 'person' : initialType
}

// =====================================================================
// 3. Wikipedia API (free, no key)
// =====================================================================
async function fetchWikipediaInfo(query, lang = 'en') {
  const cacheKey = `wiki:${lang}:${query.toLowerCase()}`
  const cached = wikiCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < WIKI_CACHE_TTL) return cached.data

  try {
    const baseUrl = `https://${lang}.wikipedia.org/w/api.php`

    // Step 1: Search for the page
    const searchParams = new URLSearchParams({
      action: 'query', list: 'search', srsearch: query,
      srlimit: '3', format: 'json', origin: '*'
    })
    const searchResp = await fetch(`${baseUrl}?${searchParams}`, {
      signal: AbortSignal.timeout(8000)
    })
    const searchData = await searchResp.json()
    const results = searchData?.query?.search
    if (!results || results.length === 0) return null

    const pageId = results[0].pageid

    // Step 2: Get extract, thumbnail, categories
    const infoParams = new URLSearchParams({
      action: 'query', pageids: pageId,
      prop: 'extracts|pageimages|categories|info',
      exintro: '1', explaintext: '1', exsentences: '6',
      piprop: 'thumbnail', pithumbsize: '300',
      cllimit: '20', inprop: 'url',
      format: 'json', origin: '*'
    })
    const infoResp = await fetch(`${baseUrl}?${infoParams}`, {
      signal: AbortSignal.timeout(8000)
    })
    const infoData = await infoResp.json()
    const page = infoData?.query?.pages?.[pageId]
    if (!page) return null

    const categories = (page.categories || []).map(c =>
      c.title.replace(/^(Category|Catégorie):/, '')
    )

    const result = {
      title: page.title,
      extract: page.extract || '',
      thumbnail: page.thumbnail?.source || null,
      url: page.fullurl || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
      categories,
      pageId
    }

    wikiCache.set(cacheKey, { data: result, ts: Date.now() })
    return result
  } catch (err) {
    console.error('[SmartSearch] Wikipedia failed:', err.message)
    return null
  }
}

// =====================================================================
// 4. Wikidata API (free, structured facts)
// =====================================================================
async function fetchWikidataFacts(pageTitle, lang = 'en') {
  try {
    // Get Wikidata item ID from Wikipedia
    const linkParams = new URLSearchParams({
      action: 'query', titles: pageTitle,
      prop: 'pageprops', ppprop: 'wikibase_item',
      format: 'json', origin: '*'
    })
    const resp1 = await fetch(
      `https://${lang}.wikipedia.org/w/api.php?${linkParams}`,
      { signal: AbortSignal.timeout(6000) }
    )
    const data1 = await resp1.json()
    const pages = data1?.query?.pages || {}
    const pageData = Object.values(pages)[0]
    const wikidataId = pageData?.pageprops?.wikibase_item
    if (!wikidataId) return null

    // Fetch Wikidata entity
    const wdResp = await fetch(
      `https://www.wikidata.org/wiki/Special:EntityData/${wikidataId}.json`,
      { signal: AbortSignal.timeout(8000) }
    )
    const wdData = await wdResp.json()
    const entity = wdData?.entities?.[wikidataId]
    if (!entity) return null

    const claims = entity.claims || {}
    const facts = {}

    // Helper: get claim value
    function getClaimValue(propId) {
      const claim = claims[propId]
      if (!claim || !claim[0]) return null
      const snak = claim[0].mainsnak
      if (!snak || snak.snaktype !== 'value') return null
      return snak.datavalue
    }

    function getTimeValue(propId) {
      const val = getClaimValue(propId)
      if (!val || val.type !== 'time') return null
      const t = val.value?.time
      if (!t) return null
      const match = t.match(/\+?(\d{4})-(\d{2})-(\d{2})/)
      return match ? `${match[3]}/${match[2]}/${match[1]}` : null
    }

    function getStringValue(propId) {
      const val = getClaimValue(propId)
      if (!val) return null
      if (val.type === 'string') return val.value
      return null
    }

    // Extract common properties
    facts.birthDate = getTimeValue('P569')
    facts.deathDate = getTimeValue('P570')
    facts.website = getStringValue('P856')
    facts.description = entity.descriptions?.[lang]?.value
      || entity.descriptions?.en?.value
      || entity.descriptions?.fr?.value || null

    // Collect Q-IDs for labels
    const qIds = []
    const entityProps = {
      birthPlace: 'P19', nationality: 'P27', occupation: 'P106'
    }
    for (const [key, propId] of Object.entries(entityProps)) {
      const val = getClaimValue(propId)
      if (val?.type === 'wikibase-entityid') {
        qIds.push({ key, id: val.value.id })
      }
    }

    // Resolve Q-IDs to labels
    if (qIds.length > 0) {
      const ids = qIds.map(q => q.id).join('|')
      const labelResp = await fetch(
        `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids}&props=labels&languages=${lang}|en|fr&format=json&origin=*`,
        { signal: AbortSignal.timeout(6000) }
      )
      const labelData = await labelResp.json()
      for (const { key, id } of qIds) {
        const labels = labelData?.entities?.[id]?.labels
        facts[key] = labels?.fr?.value || labels?.[lang]?.value || labels?.en?.value || id
      }
    }

    return facts
  } catch (err) {
    console.error('[SmartSearch] Wikidata failed:', err.message)
    return null
  }
}

// =====================================================================
// 5. DuckDuckGo Instant Answer API (free)
// =====================================================================
async function fetchDDGInstant(query) {
  try {
    const params = new URLSearchParams({
      q: query, format: 'json', no_html: '1', skip_disambig: '1'
    })
    const resp = await fetch(`https://api.duckduckgo.com/?${params}`, {
      signal: AbortSignal.timeout(6000)
    })
    const data = await resp.json()
    if (!data.Abstract && !data.Answer) return null

    return {
      abstract: data.Abstract || '',
      abstractSource: data.AbstractSource || '',
      abstractUrl: data.AbstractURL || '',
      image: data.Image ? `https://duckduckgo.com${data.Image}` : null,
      heading: data.Heading || '',
      answer: data.Answer || '',
      infobox: (data.Infobox?.content || []).filter(i => i.label && i.value),
      relatedTopics: (data.RelatedTopics || []).slice(0, 5)
        .map(t => ({ text: t.Text || '', url: t.FirstURL || '' }))
        .filter(t => t.text)
    }
  } catch (err) {
    console.error('[SmartSearch] DDG Instant failed:', err.message)
    return null
  }
}

// =====================================================================
// 6. Brave Search with infobox
// =====================================================================
async function searchBraveWithInfobox(query) {
  if (!BRAVE_API_KEY) return { results: null, infobox: null }
  try {
    const params = new URLSearchParams({
      q: query, count: '15', search_lang: 'fr'
    })
    const response = await fetch(`${BRAVE_ENDPOINT}?${params}`, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': BRAVE_API_KEY
      },
      signal: AbortSignal.timeout(10000)
    })
    if (!response.ok) throw new Error(`Brave API ${response.status}`)
    const data = await response.json()

    const web = (data.web?.results || []).slice(0, 15).map(r => ({
      title: fixEncoding(stripHtml(r.title || '')),
      url: r.url || '',
      description: fixEncoding(stripHtml(r.description || '')),
      source: extractDomain(r.url),
      age: r.age || null,
      favicon: r.profile?.img || `https://www.google.com/s2/favicons?domain=${extractDomain(r.url)}&sz=32`
    }))

    const infobox = data.infobox ? {
      title: fixEncoding(data.infobox.title || ''),
      description: fixEncoding(data.infobox.description || ''),
      longDesc: fixEncoding(data.infobox.long_desc || ''),
      image: data.infobox.images?.[0]?.src || null,
      attributes: (data.infobox.attributes || []).map(a => ({
        label: fixEncoding(a.label), value: fixEncoding(String(a.value))
      })),
      website: data.infobox.website || null
    } : null

    return { results: web.length > 0 ? web : null, infobox }
  } catch (err) {
    console.error('[SmartSearch] Brave+infobox failed:', err.message)
    return { results: null, infobox: null }
  }
}

// =====================================================================
// 7. Build Knowledge Panel
// =====================================================================
function buildKnowledgePanel(entityType, wiki, wikidata, ddg, braveInfobox) {
  if (!wiki && !ddg && !braveInfobox) return null

  const panel = {
    type: entityType === 'person_or_place' ? 'person' : entityType,
    title: '', subtitle: '', description: '',
    image: null, url: null,
    facts: [], links: []
  }

  // Title
  panel.title = wiki?.title || ddg?.heading || braveInfobox?.title || ''
  panel.url = wiki?.url || ddg?.abstractUrl || null

  // Description
  if (wiki?.extract) {
    const sentences = wiki.extract.split(/(?<=[.!?])\s+/)
    panel.description = sentences.slice(0, 3).join(' ')
  } else if (ddg?.abstract) {
    panel.description = ddg.abstract
  } else if (braveInfobox?.description) {
    panel.description = braveInfobox.description
  }

  // Subtitle
  if (wikidata?.description) panel.subtitle = wikidata.description

  // Image
  panel.image = wiki?.thumbnail || ddg?.image || braveInfobox?.image || null

  // Facts from Wikidata
  if (wikidata) {
    if (entityType === 'person' || entityType === 'person_or_place') {
      if (wikidata.birthDate) panel.facts.push({ label: 'Naissance', value: wikidata.birthDate })
      if (wikidata.deathDate) panel.facts.push({ label: 'Décès', value: wikidata.deathDate })
      if (typeof wikidata.birthPlace === 'string')
        panel.facts.push({ label: 'Lieu de naissance', value: wikidata.birthPlace })
      if (typeof wikidata.nationality === 'string')
        panel.facts.push({ label: 'Nationalité', value: wikidata.nationality })
      if (typeof wikidata.occupation === 'string')
        panel.facts.push({ label: 'Profession', value: wikidata.occupation })
    }
    if (wikidata.website) {
      panel.facts.push({ label: 'Site web', value: wikidata.website })
      panel.links.push({ label: 'Site officiel', url: wikidata.website })
    }
  }

  // Brave infobox attributes
  if (braveInfobox?.attributes) {
    for (const attr of braveInfobox.attributes) {
      if (!panel.facts.some(f => f.label.toLowerCase() === attr.label.toLowerCase())) {
        panel.facts.push({ label: attr.label, value: String(attr.value) })
      }
    }
  }

  // DDG infobox
  if (ddg?.infobox) {
    for (const item of ddg.infobox) {
      if (item.label && item.value &&
          !panel.facts.some(f => f.label.toLowerCase() === item.label.toLowerCase())) {
        panel.facts.push({ label: item.label, value: String(item.value) })
      }
    }
  }

  panel.facts = panel.facts.slice(0, 8)

  // Links
  if (wiki?.url) panel.links.push({ label: 'Wikipedia', url: wiki.url })

  return panel.title ? panel : null
}

// =====================================================================
// 8. Build Synthesized Answer
// =====================================================================
function buildSynthesizedAnswer(query, entityType, wiki, ddg, webResults) {
  const parts = []

  // Opening from Wikipedia
  if (wiki?.extract) {
    const sentences = wiki.extract.split(/(?<=[.!?])\s+/)
    if (entityType === 'person' || entityType === 'person_or_place') {
      parts.push(`<strong>${E(wiki.title)}</strong> — ${E(sentences.slice(0, 3).join(' '))}`)
    } else if (entityType === 'place') {
      parts.push(`<strong>${E(wiki.title)}</strong> est ${E(sentences[0] || '')}`)
      if (sentences[1]) parts.push(E(sentences[1]))
    } else {
      parts.push(`<strong>${E(wiki.title)}</strong> : ${E(sentences.slice(0, 3).join(' '))}`)
    }
  } else if (ddg?.abstract) {
    parts.push(E(ddg.abstract))
  }

  // Key points from web results
  if (webResults && webResults.length > 0) {
    const descriptions = webResults.slice(0, 6)
      .map(r => r.description)
      .filter(Boolean)
      .filter(d => d.length > 30)

    if (descriptions.length > 0) {
      parts.push('<br><strong>Ce que disent les sources :</strong>')
      parts.push('<ul>')
      const seen = new Set()
      for (const desc of descriptions) {
        const key = desc.substring(0, 50).toLowerCase()
        if (!seen.has(key)) {
          seen.add(key)
          parts.push(`<li>${E(desc.substring(0, 250))}</li>`)
        }
      }
      parts.push('</ul>')
    }
  }

  return parts.join('\n') || null
}

// =====================================================================
// 9. Main Handler
// =====================================================================
async function handleSmartSearch(req, res, url) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' })
  }

  const query = (url.searchParams.get('q') || '').trim()
  if (!query) {
    return sendJson(res, 400, { ok: false, error: 'Requete de recherche vide' })
  }
  if (query.length > (config.MAX_SEARCH_QUERY || 200)) {
    return sendJson(res, 400, { ok: false, error: 'Requete trop longue' })
  }

  const cacheKey = 'smart:' + query.toLowerCase()
  const now = Date.now()
  const cached = smartCache.get(cacheKey)
  if (cached && (now - cached.ts) < SMART_CACHE_TTL) {
    return sendJson(res, 200, { ...cached.data, cached: true })
  }

  try {
    // Step 1: Detect entity type (instant)
    let entityType = detectEntityType(query)

    // Step 2: Parallel fetch from all sources
    const [wikiResult, ddgResult, braveResult] = await Promise.allSettled([
      fetchWikipediaInfo(query, 'en'),
      fetchDDGInstant(query),
      searchBraveWithInfobox(query)
    ])

    let wiki = wikiResult.status === 'fulfilled' ? wikiResult.value : null
    const ddg = ddgResult.status === 'fulfilled' ? ddgResult.value : null
    const brave = braveResult.status === 'fulfilled' ? braveResult.value : { results: null, infobox: null }

    // Try French Wikipedia if English found nothing
    if (!wiki) {
      try { wiki = await fetchWikipediaInfo(query, 'fr') } catch {}
    }

    // Step 3: Refine entity type
    if (wiki) {
      entityType = refineEntityType(entityType, wiki.categories)
    }

    // Step 4: Fetch Wikidata if entity found
    let wikidataFacts = null
    if (wiki && entityType !== 'general') {
      try {
        const lang = wiki.url?.includes('fr.wikipedia') ? 'fr' : 'en'
        wikidataFacts = await fetchWikidataFacts(wiki.title, lang)
      } catch {}
    }

    // Step 5: Build knowledge panel
    const knowledgePanel = buildKnowledgePanel(
      entityType, wiki, wikidataFacts, ddg, brave.infobox
    )

    // Step 6: Web results
    let webResults = brave.results || []

    // Step 7: Build summary
    const summary = buildSynthesizedAnswer(query, entityType, wiki, ddg, webResults)

    const response = {
      ok: true,
      query,
      entityType: entityType === 'person_or_place' ? 'person' : entityType,
      knowledgePanel,
      summary,
      webResults,
      provider: 'smart'
    }

    // Cache
    smartCache.set(cacheKey, { data: response, ts: now })
    if (smartCache.size > MAX_SMART_CACHE) {
      const oldest = [...smartCache.entries()].sort((a, b) => a[1].ts - b[1].ts)
      while (smartCache.size > MAX_SMART_CACHE * 0.8) {
        smartCache.delete(oldest.shift()[0])
      }
    }

    sendJson(res, 200, response)
  } catch (err) {
    console.error('[SmartSearch] Error:', err.message)
    if (cached) {
      return sendJson(res, 200, { ...cached.data, stale: true })
    }
    sendJson(res, 500, { ok: false, error: 'Erreur recherche intelligente' })
  }
}

// =====================================================================
// Helpers
// =====================================================================
function sendJson(res, status, data) {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-cache'
  })
  res.end(body)
}

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

function E(str) {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Fix double-encoded UTF-8 (mojibake: "Ã©" → "é")
function fixEncoding(str) {
  if (!str) return str
  // Detect mojibake: if string contains Ã followed by another char, it's likely double-encoded
  if (!/[\u00c0-\u00c3][\u0080-\u00bf]/.test(str)) return str
  try {
    return Buffer.from(str, 'latin1').toString('utf8')
  } catch {
    return str
  }
}

module.exports = { handleSmartSearch }
