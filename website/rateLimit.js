// =====================================================================
// TerranoWeb In-Memory Rate Limiter
// Aucun package npm requis — tout en vanilla Node.js
// =====================================================================

const stores = new Map()

// FIX 8: Taille max par store pour éviter le memory DoS sous attaque DDoS
const MAX_STORE_SIZE = 100000

function getStore(name) {
  if (!stores.has(name)) stores.set(name, new Map())
  return stores.get(name)
}

/**
 * Verifie si une requete doit etre limitee.
 * @param {string} storeName - Namespace (ex: 'login', 'register', 'mail-send')
 * @param {string} key - Cle (typiquement IP client ou user ID)
 * @param {number} windowMs - Fenetre de temps en ms
 * @param {number} max - Nombre max de requetes dans la fenetre
 * @returns {{ limited: boolean, remaining: number, retryAfterMs: number }}
 */
function checkRateLimit(storeName, key, windowMs, max) {
  const store = getStore(storeName)
  const now = Date.now()
  let entry = store.get(key)

  if (!entry) {
    // FIX 8: Si le store est plein, supprimer la plus ancienne entrée
    if (store.size >= MAX_STORE_SIZE) {
      const firstKey = store.keys().next().value
      store.delete(firstKey)
    }
    entry = { timestamps: [] }
    store.set(key, entry)
  }

  // Nettoyer les timestamps hors fenetre
  entry.timestamps = entry.timestamps.filter(t => now - t < windowMs)

  if (entry.timestamps.length >= max) {
    const oldest = entry.timestamps[0]
    const retryAfterMs = windowMs - (now - oldest)
    return { limited: true, remaining: 0, retryAfterMs }
  }

  entry.timestamps.push(now)
  return { limited: false, remaining: max - entry.timestamps.length, retryAfterMs: 0 }
}

// Nettoyage periodique : supprime les entrees inactives depuis 1h
setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000
  for (const [, store] of stores) {
    for (const [key, entry] of store) {
      if (entry.timestamps.length === 0 || entry.timestamps[entry.timestamps.length - 1] < cutoff) {
        store.delete(key)
      }
    }
  }
}, 5 * 60 * 1000) // toutes les 5 min

module.exports = { checkRateLimit }
