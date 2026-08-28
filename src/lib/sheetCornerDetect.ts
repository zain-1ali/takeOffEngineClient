import type { ImagePoint } from './osdCoordinates'

export type DetectedCorner = {
  x: number
  y: number
  /** Relative strength (Harris score or intersection confidence). */
  score: number
  source: 'harris' | 'intersection'
}

/**
 * Detect drawing corners / line intersections in a local image patch
 * around `center` (image pixels). Pure client-side — no OpenCV.
 *
 * 1. Harris–Stephens corners on the patch (sharp junctions / L-corners)
 * 2. Two dominant edge orientations → line intersection (X / T corners)
 */
export function detectLocalCorners(
  image: CanvasImageSource & { width: number; height: number },
  center: ImagePoint,
  halfSize = 28,
): DetectedCorner[] {
  const imgW =
    'naturalWidth' in image && (image as HTMLImageElement).naturalWidth
      ? (image as HTMLImageElement).naturalWidth
      : image.width
  const imgH =
    'naturalHeight' in image && (image as HTMLImageElement).naturalHeight
      ? (image as HTMLImageElement).naturalHeight
      : image.height
  if (!(imgW > 0) || !(imgH > 0)) return []

  const cx = Math.round(center.x)
  const cy = Math.round(center.y)
  const x0 = Math.max(0, cx - halfSize)
  const y0 = Math.max(0, cy - halfSize)
  const x1 = Math.min(imgW, cx + halfSize + 1)
  const y1 = Math.min(imgH, cy + halfSize + 1)
  const w = x1 - x0
  const h = y1 - y0
  if (w < 12 || h < 12) return []

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return []
  try {
    ctx.drawImage(image, x0, y0, w, h, 0, 0, w, h)
  } catch {
    // Tainted canvas / CORS — cannot read pixels.
    return []
  }
  let imageData: ImageData
  try {
    imageData = ctx.getImageData(0, 0, w, h)
  } catch {
    return []
  }

  const gray = toGrayscale(imageData)
  const { ix, iy, mag } = sobel(gray, w, h)
  const harris = harrisCorners(ix, iy, w, h, x0, y0)
  const intersection = dominantLineIntersection(mag, ix, iy, w, h, x0, y0)

  const out = [...harris]
  if (intersection) out.push(intersection)
  out.sort((a, b) => b.score - a.score)
  return out.slice(0, 12)
}

function toGrayscale(data: ImageData): Float32Array {
  const { width, height, data: rgba } = data
  const gray = new Float32Array(width * height)
  for (let i = 0, p = 0; i < rgba.length; i += 4, p += 1) {
    // Luma — blueprints are often dark lines on light paper.
    gray[p] = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]
  }
  return gray
}

function sobel(
  gray: Float32Array,
  w: number,
  h: number,
): { ix: Float32Array; iy: Float32Array; mag: Float32Array } {
  const ix = new Float32Array(w * h)
  const iy = new Float32Array(w * h)
  const mag = new Float32Array(w * h)
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const i = y * w + x
      const gx =
        -gray[i - w - 1] +
        gray[i - w + 1] -
        2 * gray[i - 1] +
        2 * gray[i + 1] -
        gray[i + w - 1] +
        gray[i + w + 1]
      const gy =
        -gray[i - w - 1] -
        2 * gray[i - w] -
        gray[i - w + 1] +
        gray[i + w - 1] +
        2 * gray[i + w] +
        gray[i + w + 1]
      ix[i] = gx
      iy[i] = gy
      mag[i] = Math.hypot(gx, gy)
    }
  }
  return { ix, iy, mag }
}

function harrisCorners(
  ix: Float32Array,
  iy: Float32Array,
  w: number,
  h: number,
  originX: number,
  originY: number,
): DetectedCorner[] {
  const k = 0.04
  const win = 2
  const scores = new Float32Array(w * h)
  let maxR = 0

  for (let y = win + 1; y < h - win - 1; y += 1) {
    for (let x = win + 1; x < w - win - 1; x += 1) {
      let a = 0
      let b = 0
      let c = 0
      for (let dy = -win; dy <= win; dy += 1) {
        for (let dx = -win; dx <= win; dx += 1) {
          const i = (y + dy) * w + (x + dx)
          const gx = ix[i]
          const gy = iy[i]
          a += gx * gx
          b += gy * gy
          c += gx * gy
        }
      }
      const det = a * b - c * c
      const trace = a + b
      const r = det - k * trace * trace
      scores[y * w + x] = r
      if (r > maxR) maxR = r
    }
  }

  if (!(maxR > 0)) return []
  const thresh = maxR * 0.08
  const corners: DetectedCorner[] = []

  for (let y = win + 2; y < h - win - 2; y += 1) {
    for (let x = win + 2; x < w - win - 2; x += 1) {
      const i = y * w + x
      const r = scores[i]
      if (r < thresh) continue
      // 3×3 non-maximum suppression
      let isMax = true
      for (let dy = -1; dy <= 1 && isMax; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue
          if (scores[(y + dy) * w + (x + dx)] > r) {
            isMax = false
            break
          }
        }
      }
      if (!isMax) continue
      corners.push({
        x: originX + x + 0.5,
        y: originY + y + 0.5,
        score: r / maxR,
        source: 'harris',
      })
    }
  }

  corners.sort((a, b) => b.score - a.score)
  return corners.slice(0, 8)
}

/**
 * Find two dominant edge directions in the patch and return their intersection
 * (typical wall/window corner in plan drawings).
 */
function dominantLineIntersection(
  mag: Float32Array,
  ix: Float32Array,
  iy: Float32Array,
  w: number,
  h: number,
  originX: number,
  originY: number,
): DetectedCorner | null {
  let magMax = 0
  for (let i = 0; i < mag.length; i += 1) {
    if (mag[i] > magMax) magMax = mag[i]
  }
  if (!(magMax > 8)) return null
  const edgeThresh = magMax * 0.28

  // Accumulator: 36 angle bins × coarse rho
  const angleBins = 36
  const diag = Math.hypot(w, h)
  const rhoBins = Math.max(24, Math.floor(diag / 2))
  const votes = new Float32Array(angleBins * rhoBins)
  const rhoOffset = diag

  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const i = y * w + x
      if (mag[i] < edgeThresh) continue
      let theta = Math.atan2(iy[i], ix[i]) // normal angle
      if (theta < 0) theta += Math.PI
      const aBin = Math.min(
        angleBins - 1,
        Math.floor((theta / Math.PI) * angleBins),
      )
      const rho = x * Math.cos(theta) + y * Math.sin(theta)
      const rBin = Math.min(
        rhoBins - 1,
        Math.max(0, Math.floor(((rho + rhoOffset) / (2 * rhoOffset)) * rhoBins)),
      )
      votes[aBin * rhoBins + rBin] += mag[i]
    }
  }

  type Peak = { aBin: number; rBin: number; score: number; theta: number; rho: number }
  const peaks: Peak[] = []
  for (let a = 0; a < angleBins; a += 1) {
    for (let r = 0; r < rhoBins; r += 1) {
      const v = votes[a * rhoBins + r]
      if (v <= 0) continue
      // Local max in 3×3 of accumulator
      let isMax = true
      for (let da = -1; da <= 1 && isMax; da += 1) {
        for (let dr = -1; dr <= 1; dr += 1) {
          if (da === 0 && dr === 0) continue
          const aa = (a + da + angleBins) % angleBins
          const rr = r + dr
          if (rr < 0 || rr >= rhoBins) continue
          if (votes[aa * rhoBins + rr] > v) {
            isMax = false
            break
          }
        }
      }
      if (!isMax) continue
      const theta = ((a + 0.5) / angleBins) * Math.PI
      const rho = ((r + 0.5) / rhoBins) * 2 * rhoOffset - rhoOffset
      peaks.push({ aBin: a, rBin: r, score: v, theta, rho })
    }
  }

  peaks.sort((a, b) => b.score - a.score)
  if (peaks.length < 2) return null

  const first = peaks[0]
  let second: Peak | null = null
  for (let i = 1; i < peaks.length; i += 1) {
    const p = peaks[i]
    let dAng = Math.abs(p.theta - first.theta)
    if (dAng > Math.PI / 2) dAng = Math.PI - dAng
    // Prefer roughly perpendicular / distinct orientations (corners).
    if (dAng >= (25 * Math.PI) / 180) {
      second = p
      break
    }
  }
  if (!second) return null

  // Line: x cosθ + y sinθ = ρ  (θ = gradient/normal angle)
  const c1 = Math.cos(first.theta)
  const s1 = Math.sin(first.theta)
  const c2 = Math.cos(second.theta)
  const s2 = Math.sin(second.theta)
  const det = c1 * s2 - c2 * s1
  if (Math.abs(det) < 1e-6) return null

  const lx = (first.rho * s2 - second.rho * s1) / det
  const ly = (c1 * second.rho - c2 * first.rho) / det

  // Must land inside the patch (with small margin).
  if (lx < 2 || ly < 2 || lx > w - 3 || ly > h - 3) return null

  const score =
    Math.min(first.score, second.score) / Math.max(first.score, second.score) +
    0.35 * Math.min(1, (first.score + second.score) / (magMax * 40))

  return {
    x: originX + lx,
    y: originY + ly,
    score,
    source: 'intersection',
  }
}
