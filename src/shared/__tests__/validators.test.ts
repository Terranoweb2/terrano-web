import { describe, it, expect } from 'vitest'
import { classifyInput, resolveInput, isInternalUrl, sanitizeUrl } from '../validators'

// ---------------------------------------------------------------------------
// classifyInput
// ---------------------------------------------------------------------------
describe('classifyInput', () => {
  // -- explicit URL protocols -----------------------------------------------
  describe('URL_PATTERN — explicit protocol prefixes', () => {
    it('recognises http:// URLs', () => {
      const result = classifyInput('http://example.com')
      expect(result).toEqual({ type: 'url', value: 'http://example.com' })
    })

    it('recognises https:// URLs', () => {
      const result = classifyInput('https://example.com')
      expect(result).toEqual({ type: 'url', value: 'https://example.com' })
    })

    it('recognises file:// URLs', () => {
      const result = classifyInput('file:///C:/Users/test/index.html')
      expect(result).toEqual({ type: 'url', value: 'file:///C:/Users/test/index.html' })
    })

    it('recognises terrano:// URLs', () => {
      const result = classifyInput('terrano://newtab')
      expect(result).toEqual({ type: 'url', value: 'terrano://newtab' })
    })

    it('is case-insensitive for the protocol', () => {
      expect(classifyInput('HTTP://EXAMPLE.COM')).toEqual({
        type: 'url',
        value: 'HTTP://EXAMPLE.COM'
      })
      expect(classifyInput('Https://Example.com')).toEqual({
        type: 'url',
        value: 'Https://Example.com'
      })
      expect(classifyInput('TERRANO://settings')).toEqual({
        type: 'url',
        value: 'TERRANO://settings'
      })
    })

    it('handles URLs with paths, query params, and fragments', () => {
      const full = 'https://example.com/path?q=hello&lang=en#section'
      expect(classifyInput(full)).toEqual({ type: 'url', value: full })
    })

    it('handles URLs with port numbers', () => {
      const url = 'http://localhost:3000/api'
      expect(classifyInput(url)).toEqual({ type: 'url', value: url })
    })

    it('handles URLs with authentication info', () => {
      const url = 'https://user:pass@example.com'
      expect(classifyInput(url)).toEqual({ type: 'url', value: url })
    })
  })

  // -- bare domain matching via SEARCH_PATTERN ------------------------------
  describe('SEARCH_PATTERN — bare domains without protocol', () => {
    it('classifies "example.com" as a URL and prepends https://', () => {
      expect(classifyInput('example.com')).toEqual({
        type: 'url',
        value: 'https://example.com'
      })
    })

    it('classifies "sub.domain.co.uk" as a URL', () => {
      expect(classifyInput('sub.domain.co.uk')).toEqual({
        type: 'url',
        value: 'https://sub.domain.co.uk'
      })
    })

    it('classifies "example.com/path/to/page" as a URL', () => {
      expect(classifyInput('example.com/path/to/page')).toEqual({
        type: 'url',
        value: 'https://example.com/path/to/page'
      })
    })

    it('classifies a domain with two-letter TLD (e.g. .io)', () => {
      expect(classifyInput('my-site.io')).toEqual({
        type: 'url',
        value: 'https://my-site.io'
      })
    })

    it('classifies a domain with long TLD (e.g. .technology)', () => {
      expect(classifyInput('my-site.technology')).toEqual({
        type: 'url',
        value: 'https://my-site.technology'
      })
    })

    it('rejects a bare domain with single-char TLD as search', () => {
      // TLD must be at least 2 characters
      expect(classifyInput('something.a')).toEqual({
        type: 'search',
        value: 'something.a'
      })
    })

    it('rejects a domain containing a colon (port) without protocol as search', () => {
      // The pattern uses [^/:] so colons are not allowed before the dot
      expect(classifyInput('localhost:3000')).toEqual({
        type: 'search',
        value: 'localhost:3000'
      })
    })

    it('rejects a domain containing a slash before the dot as search', () => {
      expect(classifyInput('some/thing.com')).toEqual({
        type: 'search',
        value: 'some/thing.com'
      })
    })
  })

  // -- search queries -------------------------------------------------------
  describe('search queries', () => {
    it('classifies plain text as a search', () => {
      expect(classifyInput('hello world')).toEqual({
        type: 'search',
        value: 'hello world'
      })
    })

    it('classifies a single word as a search', () => {
      expect(classifyInput('weather')).toEqual({
        type: 'search',
        value: 'weather'
      })
    })

    it('classifies text with special characters as a search', () => {
      expect(classifyInput('what is 2+2?')).toEqual({
        type: 'search',
        value: 'what is 2+2?'
      })
    })

    it('classifies unknown protocols as a search', () => {
      expect(classifyInput('ftp://files.example.com')).toEqual({
        type: 'search',
        value: 'ftp://files.example.com'
      })
    })

    it('classifies a bare IP address as a search (no TLD match)', () => {
      // "192.168.1.1" — the last segment "1" is only 1 char
      expect(classifyInput('192.168.1.1')).toEqual({
        type: 'search',
        value: '192.168.1.1'
      })
    })
  })

  // -- whitespace trimming --------------------------------------------------
  describe('whitespace trimming', () => {
    it('trims leading spaces', () => {
      expect(classifyInput('   https://example.com')).toEqual({
        type: 'url',
        value: 'https://example.com'
      })
    })

    it('trims trailing spaces', () => {
      expect(classifyInput('example.com   ')).toEqual({
        type: 'url',
        value: 'https://example.com'
      })
    })

    it('trims surrounding spaces for search queries', () => {
      expect(classifyInput('  hello world  ')).toEqual({
        type: 'search',
        value: 'hello world'
      })
    })
  })

  // -- edge cases -----------------------------------------------------------
  describe('edge cases', () => {
    it('handles an empty string as a search', () => {
      expect(classifyInput('')).toEqual({ type: 'search', value: '' })
    })

    it('handles whitespace-only input as a search', () => {
      expect(classifyInput('   ')).toEqual({ type: 'search', value: '' })
    })

    it('handles "https://" alone (no host)', () => {
      expect(classifyInput('https://')).toEqual({
        type: 'url',
        value: 'https://'
      })
    })

    it('handles terrano://newtab', () => {
      expect(classifyInput('terrano://newtab')).toEqual({
        type: 'url',
        value: 'terrano://newtab'
      })
    })
  })
})

// ---------------------------------------------------------------------------
// resolveInput
// ---------------------------------------------------------------------------
describe('resolveInput', () => {
  const searchEngine = 'https://www.google.com/search?q='

  it('returns the URL directly for an http:// input', () => {
    expect(resolveInput('https://example.com', searchEngine)).toBe(
      'https://example.com'
    )
  })

  it('returns https:// prefixed URL for a bare domain', () => {
    expect(resolveInput('example.com', searchEngine)).toBe(
      'https://example.com'
    )
  })

  it('builds a search URL for a plain text query', () => {
    expect(resolveInput('hello world', searchEngine)).toBe(
      'https://www.google.com/search?q=hello%20world'
    )
  })

  it('encodes special characters in the search query', () => {
    expect(resolveInput('what is 2+2?', searchEngine)).toBe(
      'https://www.google.com/search?q=what%20is%202%2B2%3F'
    )
  })

  it('works with a different search engine', () => {
    const ddg = 'https://duckduckgo.com/?q='
    expect(resolveInput('test query', ddg)).toBe(
      'https://duckduckgo.com/?q=test%20query'
    )
  })

  it('returns internal URLs as-is', () => {
    expect(resolveInput('terrano://newtab', searchEngine)).toBe(
      'terrano://newtab'
    )
  })

  it('returns file:// URLs as-is', () => {
    expect(resolveInput('file:///tmp/test.html', searchEngine)).toBe(
      'file:///tmp/test.html'
    )
  })

  it('encodes unicode characters in search queries', () => {
    const result = resolveInput('cafe\u0301', searchEngine)
    expect(result).toContain('https://www.google.com/search?q=')
    expect(result).toContain('caf')
  })
})

// ---------------------------------------------------------------------------
// isInternalUrl
// ---------------------------------------------------------------------------
describe('isInternalUrl', () => {
  it('returns true for terrano://newtab', () => {
    expect(isInternalUrl('terrano://newtab')).toBe(true)
  })

  it('returns true for terrano://settings', () => {
    expect(isInternalUrl('terrano://settings')).toBe(true)
  })

  it('returns true for terrano:// with no path', () => {
    expect(isInternalUrl('terrano://')).toBe(true)
  })

  it('returns false for https:// URLs', () => {
    expect(isInternalUrl('https://example.com')).toBe(false)
  })

  it('returns false for http:// URLs', () => {
    expect(isInternalUrl('http://example.com')).toBe(false)
  })

  it('returns false for file:// URLs', () => {
    expect(isInternalUrl('file:///tmp/test.html')).toBe(false)
  })

  it('returns false for an empty string', () => {
    expect(isInternalUrl('')).toBe(false)
  })

  it('returns false when terrano:// appears mid-string', () => {
    expect(isInternalUrl('https://example.com?redirect=terrano://newtab')).toBe(
      false
    )
  })

  it('is case-sensitive (TERRANO:// is not internal)', () => {
    expect(isInternalUrl('TERRANO://newtab')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// sanitizeUrl
// ---------------------------------------------------------------------------
describe('sanitizeUrl', () => {
  // -- allowed protocols ----------------------------------------------------
  describe('allowed protocols', () => {
    it('allows http: URLs', () => {
      expect(sanitizeUrl('http://example.com')).toBe('http://example.com')
    })

    it('allows https: URLs', () => {
      expect(sanitizeUrl('https://example.com')).toBe('https://example.com')
    })

    it('allows file: URLs', () => {
      expect(sanitizeUrl('file:///C:/test.html')).toBe(
        'file:///C:/test.html'
      )
    })

    it('allows terrano: URLs', () => {
      expect(sanitizeUrl('terrano://newtab')).toBe('terrano://newtab')
    })

    it('preserves query params and fragments', () => {
      const url = 'https://example.com/path?q=1&r=2#top'
      expect(sanitizeUrl(url)).toBe(url)
    })
  })

  // -- blocked protocols ----------------------------------------------------
  describe('blocked protocols', () => {
    it('blocks javascript: URLs', () => {
      expect(sanitizeUrl('javascript:alert(1)')).toBe('about:blank')
    })

    it('blocks data: URLs', () => {
      expect(sanitizeUrl('data:text/html,<h1>hi</h1>')).toBe('about:blank')
    })

    it('blocks ftp: URLs', () => {
      expect(sanitizeUrl('ftp://files.example.com')).toBe('about:blank')
    })

    it('blocks blob: URLs', () => {
      expect(sanitizeUrl('blob:https://example.com/abc')).toBe('about:blank')
    })

    it('blocks vbscript: URLs', () => {
      expect(sanitizeUrl('vbscript:msgbox("hi")')).toBe('about:blank')
    })
  })

  // -- invalid URLs ---------------------------------------------------------
  describe('invalid / malformed URLs', () => {
    it('returns about:blank for a plain string', () => {
      expect(sanitizeUrl('not a url')).toBe('about:blank')
    })

    it('returns about:blank for an empty string', () => {
      expect(sanitizeUrl('')).toBe('about:blank')
    })

    it('returns about:blank for a bare domain (no protocol)', () => {
      expect(sanitizeUrl('example.com')).toBe('about:blank')
    })

    it('returns about:blank for whitespace', () => {
      expect(sanitizeUrl('   ')).toBe('about:blank')
    })
  })
})
