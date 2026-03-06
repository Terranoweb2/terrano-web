/**
 * Generate high-quality ICO file from the TerranoWeb logo PNG
 * Uses sharp for lanczos3 resampling → crisp rendering at all sizes
 */

const sharp = require('sharp')
const toIco = require('to-ico')
const fs = require('fs')
const path = require('path')

const SOURCE = path.join(__dirname, '..', 'build', 'icon.png')
const OUTPUT_ICO = path.join(__dirname, '..', 'build', 'icon.ico')

// Standard Windows ICO sizes for crisp rendering at all DPIs
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]

async function main() {
  console.log('Reading source icon:', SOURCE)

  const sourceBuffer = fs.readFileSync(SOURCE)
  const metadata = await sharp(sourceBuffer).metadata()
  console.log(`Source: ${metadata.width}x${metadata.height}, format: ${metadata.format}`)

  // Step 1: Create a high-quality 512x512 base if source is smaller
  let baseBuffer
  if (metadata.width < 512 || metadata.height < 512) {
    console.log('Upscaling to 512x512 with lanczos3...')
    baseBuffer = await sharp(sourceBuffer)
      .resize(512, 512, {
        kernel: sharp.kernel.lanczos3,
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png({ compressionLevel: 9 })
      .toBuffer()

    // Save 512x512 as the new icon.png source for future builds
    fs.writeFileSync(SOURCE, baseBuffer)
    console.log('Saved upscaled 512x512 icon.png')
  } else {
    baseBuffer = sourceBuffer
    console.log('Source already >= 512x512, using as-is')
  }

  // Step 2: Generate all ICO sizes with high-quality downsampling
  console.log('\nGenerating ICO sizes:')
  const pngBuffers = []
  for (const size of ICO_SIZES) {
    const buf = await sharp(baseBuffer)
      .resize(size, size, {
        kernel: sharp.kernel.lanczos3,
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png({ compressionLevel: 9 })
      .toBuffer()

    console.log(`  ${size}x${size}: ${(buf.length / 1024).toFixed(1)} KB`)
    pngBuffers.push(buf)
  }

  // Step 3: Combine into ICO using to-ico
  console.log('\nCreating ICO file...')
  const icoBuffer = await toIco(pngBuffers)

  fs.writeFileSync(OUTPUT_ICO, icoBuffer)
  console.log(`ICO saved: ${OUTPUT_ICO} (${(icoBuffer.length / 1024).toFixed(1)} KB)`)
  console.log('Done! Icon quality improved ✓')
}

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
