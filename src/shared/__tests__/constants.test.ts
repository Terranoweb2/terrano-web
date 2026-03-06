import { describe, it, expect } from 'vitest'
import {
  APP_NAME,
  DEFAULT_SEARCH_ENGINE,
  NEW_TAB_URL,
  DEFAULT_WINDOW_WIDTH,
  DEFAULT_WINDOW_HEIGHT,
  MIN_WINDOW_WIDTH,
  MIN_WINDOW_HEIGHT,
  TAB_BAR_HEIGHT,
  TOOLBAR_HEIGHT,
  UI_SHELL_HEIGHT
} from '../constants'

describe('constants', () => {
  // -- Application metadata -------------------------------------------------
  describe('application metadata', () => {
    it('APP_NAME is "TerranoWeb"', () => {
      expect(APP_NAME).toBe('TerranoWeb')
    })

    it('DEFAULT_SEARCH_ENGINE points to Google', () => {
      expect(DEFAULT_SEARCH_ENGINE).toBe('https://www.google.com/search?q=')
    })

    it('DEFAULT_SEARCH_ENGINE is a valid URL prefix', () => {
      // Appending a query term should produce a valid URL
      const url = new URL(`${DEFAULT_SEARCH_ENGINE}test`)
      expect(url.protocol).toBe('https:')
      expect(url.hostname).toBe('www.google.com')
      expect(url.pathname).toBe('/search')
      expect(url.searchParams.get('q')).toBe('test')
    })

    it('NEW_TAB_URL uses the terrano:// protocol', () => {
      expect(NEW_TAB_URL).toBe('terrano://newtab')
      expect(NEW_TAB_URL.startsWith('terrano://')).toBe(true)
    })
  })

  // -- Window dimensions ---------------------------------------------------
  describe('window dimensions', () => {
    it('DEFAULT_WINDOW_WIDTH is 1280', () => {
      expect(DEFAULT_WINDOW_WIDTH).toBe(1280)
    })

    it('DEFAULT_WINDOW_HEIGHT is 800', () => {
      expect(DEFAULT_WINDOW_HEIGHT).toBe(800)
    })

    it('MIN_WINDOW_WIDTH is 400', () => {
      expect(MIN_WINDOW_WIDTH).toBe(400)
    })

    it('MIN_WINDOW_HEIGHT is 300', () => {
      expect(MIN_WINDOW_HEIGHT).toBe(300)
    })

    it('default dimensions are larger than minimum dimensions', () => {
      expect(DEFAULT_WINDOW_WIDTH).toBeGreaterThan(MIN_WINDOW_WIDTH)
      expect(DEFAULT_WINDOW_HEIGHT).toBeGreaterThan(MIN_WINDOW_HEIGHT)
    })

    it('minimum dimensions are positive numbers', () => {
      expect(MIN_WINDOW_WIDTH).toBeGreaterThan(0)
      expect(MIN_WINDOW_HEIGHT).toBeGreaterThan(0)
    })
  })

  // -- UI dimensions --------------------------------------------------------
  describe('UI layout dimensions', () => {
    it('TAB_BAR_HEIGHT is 38', () => {
      expect(TAB_BAR_HEIGHT).toBe(38)
    })

    it('TOOLBAR_HEIGHT is 42', () => {
      expect(TOOLBAR_HEIGHT).toBe(42)
    })

    it('UI_SHELL_HEIGHT equals TAB_BAR_HEIGHT + TOOLBAR_HEIGHT', () => {
      expect(UI_SHELL_HEIGHT).toBe(TAB_BAR_HEIGHT + TOOLBAR_HEIGHT)
    })

    it('UI_SHELL_HEIGHT is 80', () => {
      expect(UI_SHELL_HEIGHT).toBe(80)
    })

    it('UI_SHELL_HEIGHT is less than MIN_WINDOW_HEIGHT (content area remains)', () => {
      expect(UI_SHELL_HEIGHT).toBeLessThan(MIN_WINDOW_HEIGHT)
    })
  })

  // -- Type checks ----------------------------------------------------------
  describe('type correctness', () => {
    it('all string constants are strings', () => {
      expect(typeof APP_NAME).toBe('string')
      expect(typeof DEFAULT_SEARCH_ENGINE).toBe('string')
      expect(typeof NEW_TAB_URL).toBe('string')
    })

    it('all numeric constants are numbers', () => {
      expect(typeof DEFAULT_WINDOW_WIDTH).toBe('number')
      expect(typeof DEFAULT_WINDOW_HEIGHT).toBe('number')
      expect(typeof MIN_WINDOW_WIDTH).toBe('number')
      expect(typeof MIN_WINDOW_HEIGHT).toBe('number')
      expect(typeof TAB_BAR_HEIGHT).toBe('number')
      expect(typeof TOOLBAR_HEIGHT).toBe('number')
      expect(typeof UI_SHELL_HEIGHT).toBe('number')
    })

    it('numeric constants are integers (not floats)', () => {
      expect(Number.isInteger(DEFAULT_WINDOW_WIDTH)).toBe(true)
      expect(Number.isInteger(DEFAULT_WINDOW_HEIGHT)).toBe(true)
      expect(Number.isInteger(MIN_WINDOW_WIDTH)).toBe(true)
      expect(Number.isInteger(MIN_WINDOW_HEIGHT)).toBe(true)
      expect(Number.isInteger(TAB_BAR_HEIGHT)).toBe(true)
      expect(Number.isInteger(TOOLBAR_HEIGHT)).toBe(true)
      expect(Number.isInteger(UI_SHELL_HEIGHT)).toBe(true)
    })
  })
})
