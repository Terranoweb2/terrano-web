import type { TabManager } from '../tabs/TabManager'

/**
 * Full-page scroll-and-stitch capture.
 * Scrolls the page in viewport-sized chunks, captures each strip,
 * then stitches them vertically using sharp.
 */
export async function captureFullPage(
  tabManager: TabManager,
  tabId: string
): Promise<string> {
  const wc = tabManager.getTabWebContents(tabId)
  if (!wc) throw new Error('Tab not found')

  // 1. Get page dimensions via JS injection
  const dimsJson = await wc.executeJavaScript(`
    JSON.stringify({
      scrollHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
      scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
      originalScrollX: window.scrollX,
      originalScrollY: window.scrollY,
      devicePixelRatio: window.devicePixelRatio || 1
    })
  `)

  const dims = JSON.parse(dimsJson) as {
    scrollHeight: number
    scrollWidth: number
    viewportHeight: number
    viewportWidth: number
    originalScrollX: number
    originalScrollY: number
    devicePixelRatio: number
  }

  const { scrollHeight, viewportHeight, originalScrollX, originalScrollY, devicePixelRatio } =
    dims

  // Safety: limit max height to prevent memory issues (max 16384px logical)
  const maxHeight = Math.min(scrollHeight, 16384)
  const totalStrips = Math.ceil(maxHeight / viewportHeight)

  if (totalStrips <= 1) {
    // Page fits in one viewport — just capture visible
    const image = await wc.capturePage()
    return image.toDataURL()
  }

  // 2. Temporarily hide fixed elements to avoid duplication in strips
  await wc.executeJavaScript(`
    (function() {
      window.__fixedEls = [];
      document.querySelectorAll('*').forEach(el => {
        const style = getComputedStyle(el);
        if (style.position === 'fixed' || style.position === 'sticky') {
          window.__fixedEls.push({ el, pos: style.position });
          el.style.setProperty('position', 'absolute', 'important');
        }
      });
    })()
  `)

  // 3. Capture each strip
  const strips: Buffer[] = []
  const stripHeights: number[] = []

  try {
    for (let i = 0; i < totalStrips; i++) {
      const scrollY = i * viewportHeight
      await wc.executeJavaScript(`window.scrollTo(0, ${scrollY})`)
      // Wait for rendering
      await new Promise((r) => setTimeout(r, 200))

      const image = await wc.capturePage()
      strips.push(image.toPNG())

      // Last strip may be partial
      const remaining = maxHeight - scrollY
      const stripH = Math.min(viewportHeight, remaining)
      stripHeights.push(Math.round(stripH * devicePixelRatio))
    }
  } finally {
    // 4. Restore fixed elements and scroll position
    await wc.executeJavaScript(`
      (function() {
        if (window.__fixedEls) {
          window.__fixedEls.forEach(({ el, pos }) => {
            el.style.position = pos;
          });
          delete window.__fixedEls;
        }
        window.scrollTo(${originalScrollX}, ${originalScrollY});
      })()
    `)
  }

  // 5. Stitch strips vertically using sharp
  try {
    const sharp = require('sharp')
    const totalPixelWidth = Math.round(dims.viewportWidth * devicePixelRatio)
    const totalPixelHeight = stripHeights.reduce((sum, h) => sum + h, 0)

    // Create composite inputs
    const compositeInputs: { input: Buffer; top: number; left: number }[] = []
    let yOffset = 0

    for (let i = 0; i < strips.length; i++) {
      // Crop strip to correct height (last strip may have extra)
      const cropped = await sharp(strips[i])
        .extract({
          left: 0,
          top: 0,
          width: totalPixelWidth,
          height: stripHeights[i]
        })
        .toBuffer()

      compositeInputs.push({ input: cropped, top: yOffset, left: 0 })
      yOffset += stripHeights[i]
    }

    const stitched = await sharp({
      create: {
        width: totalPixelWidth,
        height: totalPixelHeight,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    })
      .composite(compositeInputs)
      .png({ compressionLevel: 6 })
      .toBuffer()

    return `data:image/png;base64,${stitched.toString('base64')}`
  } catch (err) {
    // Fallback if sharp fails: just return first strip (visible viewport)
    console.error('[Screenshot] Full-page stitch failed, falling back to visible:', err)
    const fallback = await wc.capturePage()
    return fallback.toDataURL()
  }
}
