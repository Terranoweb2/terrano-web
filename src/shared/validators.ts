const URL_PATTERN = /^(https?:\/\/|file:\/\/|terrano:\/\/)/i
const SEARCH_PATTERN = /^[^/:]+\.[a-z]{2,}(\/.*)?$/i

export function classifyInput(input: string): { type: 'url' | 'search'; value: string } {
  const trimmed = input.trim()

  if (URL_PATTERN.test(trimmed)) {
    return { type: 'url', value: trimmed }
  }

  if (SEARCH_PATTERN.test(trimmed)) {
    return { type: 'url', value: `https://${trimmed}` }
  }

  return { type: 'search', value: trimmed }
}

export function resolveInput(input: string, searchEngine: string): string {
  const { type, value } = classifyInput(input)
  if (type === 'url') return value
  return `${searchEngine}${encodeURIComponent(value)}`
}

export function isInternalUrl(url: string): boolean {
  return url.startsWith('terrano://')
}

export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:', 'file:', 'terrano:'].includes(parsed.protocol)) {
      return 'about:blank'
    }
    return url
  } catch {
    return 'about:blank'
  }
}
