import { TAB_BAR_HEIGHT, TOOLBAR_HEIGHT } from '@shared/constants'

const TITLEBAR_HEIGHT = 32

interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

/**
 * UI Shell couvre toute la fenêtre.
 * Le Shell est placé EN DESSOUS du TabView — seules les zones non couvertes
 * par le TabView (toolbar en haut, sidebar à droite) sont visibles/cliquables.
 */
export function getUIShellBounds(windowWidth: number, windowHeight: number): Bounds {
  return { x: 0, y: 0, width: windowWidth, height: windowHeight }
}

/**
 * Le TabView couvre la zone de contenu web.
 * Quand le sidebar est ouvert, sa largeur est réduite pour laisser le Shell visible à droite.
 */
export function getTabViewBounds(
  windowWidth: number,
  windowHeight: number,
  sidebarWidth: number = 0
): Bounds {
  const topOffset = TITLEBAR_HEIGHT + TAB_BAR_HEIGHT + TOOLBAR_HEIGHT
  return {
    x: 0,
    y: topOffset,
    width: Math.max(windowWidth - sidebarWidth, 200),
    height: windowHeight - topOffset
  }
}
