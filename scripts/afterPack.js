// Hook electron-builder afterPack: patche l'icône de l'exe avant la création NSIS
const path = require('path')

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return

  const exePath = path.join(context.appOutDir, 'TerranoWeb.exe')
  const icoPath = path.resolve(__dirname, '..', 'build', 'icon.ico')

  console.log(`  • patching icon  exe=${exePath}`)

  // rcedit v5 is ESM-only, use dynamic import
  const { rcedit } = await import('rcedit')
  await rcedit(exePath, { icon: icoPath })

  console.log(`  • icon patched successfully`)
}
