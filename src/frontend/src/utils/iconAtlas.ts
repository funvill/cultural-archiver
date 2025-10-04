/**
 * Icon atlas utility for SVG rasterization and caching
 * Converts SVG icons to ImageBitmap for high-performance WebGL rendering
 */

export interface IconConfig {
  name: string
  svg?: string // SVG string
  url?: string // Image URL (PNG/JPG)
  size?: number // Target size in pixels
}

export interface IconAtlas {
  icons: Map<string, ImageBitmap | HTMLImageElement>
  isReady: boolean
}

/**
 * Rasterize an SVG string to ImageBitmap
 * Uses OffscreenCanvas if available for better performance
 * @param svgString - SVG markup as string
 * @param size - Target size in pixels (default: 64)
 */
export async function rasterizeSVG(
  svgString: string,
  size: number = 64
): Promise<ImageBitmap | HTMLImageElement> {
  try {
    // Create blob from SVG string
    const blob = new Blob([svgString], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)

    // Load image from blob
    const img = new Image(size, size)
    img.src = url

    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
    })

    // Clean up blob URL
    URL.revokeObjectURL(url)

    // Convert to ImageBitmap if supported (better for canvas/WebGL)
    if (typeof createImageBitmap !== 'undefined') {
      const bitmap = await createImageBitmap(img, {
        resizeWidth: size,
        resizeHeight: size,
        resizeQuality: 'high'
      })
      return bitmap
    }

    return img
  } catch (error) {
    console.error('Failed to rasterize SVG:', error)
    throw error
  }
}

/**
 * Load an image from URL
 * @param url - Image URL
 * @param size - Target size (optional)
 */
export async function loadImage(
  url: string,
  size?: number
): Promise<ImageBitmap | HTMLImageElement> {
  const img = new Image()
  if (size) {
    img.width = size
    img.height = size
  }
  img.src = url

  await new Promise((resolve, reject) => {
    img.onload = resolve
    img.onerror = reject
  })

  // Convert to ImageBitmap if supported
  if (typeof createImageBitmap !== 'undefined' && size) {
    const bitmap = await createImageBitmap(img, {
      resizeWidth: size,
      resizeHeight: size,
      resizeQuality: 'high'
    })
    return bitmap
  }

  return img
}

/**
 * Create an icon atlas from a map of icon configurations
 * Pre-loads and caches all icons for fast rendering
 * @param iconConfigs - Array of icon configurations
 */
export async function createIconAtlas(iconConfigs: IconConfig[]): Promise<IconAtlas> {
  const icons = new Map<string, ImageBitmap | HTMLImageElement>()
  const promises: Promise<void>[] = []

  for (const config of iconConfigs) {
    const promise = (async (): Promise<void> => {
      try {
        let icon: ImageBitmap | HTMLImageElement

        if (config.svg) {
          icon = await rasterizeSVG(config.svg, config.size || 64)
        } else if (config.url) {
          icon = await loadImage(config.url, config.size)
        } else {
          throw new Error(`Icon ${config.name} has no SVG or URL`)
        }

        icons.set(config.name, icon)
      } catch (error) {
        console.error(`Failed to load icon ${config.name}:`, error)
      }
    })()

    promises.push(promise)
  }

  await Promise.all(promises)

  return {
    icons,
    isReady: true
  }
}

/**
 * Get icon from atlas by name
 * @param atlas - Icon atlas
 * @param name - Icon name
 * @param fallback - Fallback icon name if primary not found
 */
export function getIcon(
  atlas: IconAtlas,
  name: string,
  fallback: string = 'default'
): ImageBitmap | HTMLImageElement | null {
  return atlas.icons.get(name) || atlas.icons.get(fallback) || null
}

/**
 * Dispose of all ImageBitmaps in the atlas to free GPU memory
 * @param atlas - Icon atlas to dispose
 */
export function disposeIconAtlas(atlas: IconAtlas): void {
  for (const [_name, icon] of atlas.icons) {
    if (icon instanceof ImageBitmap) {
      icon.close()
    }
  }
  atlas.icons.clear()
}

/**
 * Pre-defined SVG icons for common artwork types
 * These can be customized or replaced with your own icons
 */
export const DEFAULT_ICONS: Record<string, string> = {
  sculpture: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
    <circle cx="32" cy="32" r="28" fill="#3B82F6" stroke="#1E40AF" stroke-width="3"/>
    <path d="M32 16 L40 32 L32 48 L24 32 Z" fill="white" opacity="0.9"/>
  </svg>`,
  
  mural: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
    <rect x="8" y="12" width="48" height="40" rx="4" fill="#10B981" stroke="#047857" stroke-width="3"/>
    <rect x="16" y="20" width="32" height="24" fill="white" opacity="0.8"/>
  </svg>`,
  
  installation: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
    <circle cx="32" cy="32" r="28" fill="#8B5CF6" stroke="#6D28D9" stroke-width="3"/>
    <rect x="24" y="24" width="16" height="16" fill="white" opacity="0.9" transform="rotate(45 32 32)"/>
  </svg>`,
  
  default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
    <circle cx="32" cy="32" r="28" fill="#6B7280" stroke="#374151" stroke-width="3"/>
    <circle cx="32" cy="32" r="8" fill="white" opacity="0.9"/>
  </svg>`,
  
  cluster: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
    <circle cx="32" cy="32" r="30" fill="#EF4444" stroke="#991B1B" stroke-width="3"/>
    <text x="32" y="38" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="white">•••</text>
  </svg>`,
  
  visited: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
    <circle cx="32" cy="32" r="28" fill="#9CA3AF" stroke="#6B7280" stroke-width="3"/>
    <path d="M20 32 L28 40 L44 24" stroke="white" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </svg>`,
  
  starred: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
    <circle cx="32" cy="32" r="28" fill="#FBBF24" stroke="#F59E0B" stroke-width="3"/>
    <path d="M32 16 L36 28 L48 28 L38 36 L42 48 L32 40 L22 48 L26 36 L16 28 L28 28 Z" fill="white" stroke="none"/>
  </svg>`,
  
  userLocation: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
    <!-- Person icon -->
    <circle cx="32" cy="20" r="10" fill="#2196F3"/>
    <path d="M 32 30 L 20 50 L 24 50 L 32 35 L 40 50 L 44 50 Z" fill="#2196F3"/>
    <!-- Outer circle/ring -->
    <circle cx="32" cy="32" r="30" fill="none" stroke="#2196F3" stroke-width="3" opacity="0.5"/>
  </svg>`,
  
  userLocationCone: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
    <!-- View cone wedge (45° spread) -->
    <path d="M 50 50 L 100 25 A 50 50 0 0 1 100 75 Z" fill="#2196F3" opacity="0.3"/>
  </svg>`
}
