/**
 * Load a sheet PNG for local corner detection (getImageData).
 * Uses credentials so Railway/local authenticated /uploads work.
 */

const cache = new Map<string, HTMLImageElement | null>()
const inflight = new Map<string, Promise<HTMLImageElement | null>>()

export function getCachedSheetImage(url: string): HTMLImageElement | null {
  return cache.get(url) ?? null
}

export function loadSheetImageForSnap(url: string): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null)
  if (cache.has(url)) return Promise.resolve(cache.get(url) ?? null)
  const pending = inflight.get(url)
  if (pending) return pending

  const job = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image()
    img.decoding = 'async'
    // Prefer credentials for cookie-auth uploads; anonymous as fallback path.
    img.crossOrigin = 'use-credentials'
    img.onload = () => {
      cache.set(url, img)
      inflight.delete(url)
      resolve(img)
    }
    img.onerror = () => {
      // Retry once without credentials (public CDN / unsigned URLs).
      const img2 = new Image()
      img2.crossOrigin = 'anonymous'
      img2.onload = () => {
        cache.set(url, img2)
        inflight.delete(url)
        resolve(img2)
      }
      img2.onerror = () => {
        cache.set(url, null)
        inflight.delete(url)
        resolve(null)
      }
      img2.src = url
    }
    img.src = url
  })
  inflight.set(url, job)
  return job
}
