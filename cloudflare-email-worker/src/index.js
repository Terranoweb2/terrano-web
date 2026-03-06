/**
 * Cloudflare Email Worker for TerranoWeb
 *
 * Receives incoming emails via Cloudflare Email Routing,
 * parses them, and forwards to TerranoWeb's webhook API.
 *
 * Setup:
 * 1. Enable Email Routing on terranoweb.win in Cloudflare Dashboard
 * 2. Deploy this worker: npx wrangler deploy
 * 3. Add a catch-all route: *@terranoweb.win → this worker
 */

import PostalMime from 'postal-mime'

export default {
  async email(message, env, ctx) {
    try {
      const from = message.from
      const to = message.to

      // Skip noreply loop
      if (from.includes('noreply@terranomail.org')) {
        console.log(`Skipping noreply loop: ${from}`)
        return
      }

      // Read raw email as ArrayBuffer
      const rawEmail = await new Response(message.raw).arrayBuffer()

      // Parse with PostalMime
      const parser = new PostalMime()
      const parsed = await parser.parse(rawEmail)

      const subject = parsed.subject || '(sans objet)'

      // Extract text body (prefer plain text, fallback to stripped HTML)
      let body = ''
      if (parsed.text) {
        body = parsed.text
      } else if (parsed.html) {
        // Basic HTML to text conversion
        body = parsed.html
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<p[^>]*>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(code))
          .trim()
      }

      if (!body) {
        body = '(contenu non disponible)'
      }

      // Extract sender name from parsed headers
      const fromName = parsed.from?.name || from.split('@')[0] || from

      console.log(`Processing email: ${from} → ${to} | Subject: ${subject}`)

      // POST to TerranoWeb webhook
      const response = await fetch(env.WEBHOOK_URL || 'https://terranoweb.win/api/mail/incoming', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'TerranoWeb-CF-EmailWorker/1.0',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          secret: env.WEBHOOK_SECRET,
          from: from,
          fromName: fromName,
          to: to,
          subject: subject,
          body: body
        })
      })

      const result = await response.text()
      console.log(`Webhook response: ${response.status} — ${result}`)

      if (!response.ok) {
        // Log error but don't throw — we don't want Cloudflare to bounce the email
        console.error(`Webhook error: HTTP ${response.status} — ${result}`)
      }
    } catch (err) {
      // Log and swallow — never throw in email handler (causes bounce)
      console.error(`Email processing error: ${err.message}`)
      console.error(err.stack)
    }
  }
}
