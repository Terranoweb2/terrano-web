// =====================================================================
// TerranoWeb Security Configuration
// Centralise les secrets et constantes de securite
// =====================================================================
const fs = require('fs')
const path = require('path')

// --- Load secrets from secrets.json (or env vars as fallback) ---
let secrets = {}
const secretsPath = path.join(__dirname, 'secrets.json')
if (fs.existsSync(secretsPath)) {
  try {
    secrets = JSON.parse(fs.readFileSync(secretsPath, 'utf8'))
    console.log('[Config] Secrets loaded from secrets.json')
  } catch (e) {
    console.error('[Config] Failed to parse secrets.json:', e.message)
  }
} else {
  console.warn('[Config] secrets.json not found — using environment variables')
}

function get(key, fallback) {
  return secrets[key] || process.env[key] || fallback || ''
}

module.exports = {
  // --- Secrets ---
  SMTP_USER: get('SMTP_USER'),
  SMTP_PASS: get('SMTP_PASS'),
  SMTP_HOST: get('SMTP_HOST', 'bore.pub'),
  SMTP_PORT: parseInt(get('SMTP_PORT', '2501')),
  BRAVE_API_KEY: get('BRAVE_SEARCH_KEY'),
  WEBHOOK_SECRET: get('WEBHOOK_SECRET'),

  // --- Rate Limiting ---
  RATE_LIMIT: {
    LOGIN_WINDOW_MS: 15 * 60 * 1000,      // 15 min
    LOGIN_MAX: 10,                          // 10 attempts per window
    REGISTER_WINDOW_MS: 60 * 60 * 1000,    // 1 hour
    REGISTER_MAX: 5,                        // 5 registrations per IP/hour
    CHECK_EMAIL_WINDOW_MS: 60 * 1000,      // 1 min
    CHECK_EMAIL_MAX: 20,                    // 20 checks per min
    MAIL_SEND_WINDOW_MS: 60 * 1000,        // 1 min
    MAIL_SEND_MAX: 10,                      // 10 emails per minute
    WEBHOOK_WINDOW_MS: 60 * 1000,          // 1 min
    WEBHOOK_MAX: 30,                        // 30 webhook calls per min
    GLOBAL_WINDOW_MS: 60 * 1000,           // 1 min
    GLOBAL_MAX: 120,                        // 120 API requests per min per IP
    PROXY_WINDOW_MS: 60 * 1000,            // 1 min
    PROXY_MAX: 300                          // 300 proxy requests per min per IP (HLS = many segments)
  },

  // --- Body Size Limits ---
  BODY_SIZE_LIMIT: 5 * 1024 * 1024,        // 5 Mo default
  MAIL_BODY_SIZE_LIMIT: 30 * 1024 * 1024,  // 30 Mo (pieces jointes)

  // --- Session ---
  SESSION_MAX_AGE_MS: 7 * 24 * 60 * 60 * 1000, // 7 jours (au lieu de 30)

  // --- Password Policy ---
  PASSWORD_MIN_LENGTH: 8,

  // --- Account Lockout ---
  ACCOUNT_LOCKOUT_THRESHOLD: 10,            // verrouillage apres 10 echecs
  ACCOUNT_LOCKOUT_DURATION_MS: 15 * 60 * 1000, // 15 min de verrouillage

  // --- Input Limits ---
  MAX_EMAIL_SUBJECT: 500,
  MAX_EMAIL_BODY: 100000,
  MAX_EMAIL_ADDRESS: 254,
  MAX_NAME_LENGTH: 50,
  MAX_DISPLAY_NAME: 100,
  MAX_SEARCH_QUERY: 200
}
