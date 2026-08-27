/** Image-space point (pixel coordinates on the source sheet PNG). */
export interface ImagePoint {
  x: number;
  y: number;
}

/** Euclidean distance between two image-space points (pixels). */
export function segmentLengthPx(a: ImagePoint, b: ImagePoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.hypot(dx, dy);
}

/**
 * Total length of a polyline in image pixels.
 * Requires at least 2 points; returns 0 otherwise.
 */
export function polylineLengthPx(points: readonly ImagePoint[]): number {
  if (points.length < 2) {
    return 0;
  }

  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    total += segmentLengthPx(points[i], points[i + 1]);
  }
  return total;
}

/**
 * Absolute area of a polygon in image pixel² via the shoelace formula.
 * Vertices may be clockwise or counter-clockwise; result is always ≥ 0.
 * Requires at least 3 points; returns 0 otherwise.
 *
 * A = 1/2 * |Σ (x_i * y_{i+1} - x_{i+1} * y_i)|  (with y_n = y_0, x_n = x_0)
 */
export function polygonAreaPx2(points: readonly ImagePoint[]): number {
  if (points.length < 3) {
    return 0;
  }

  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    sum += current.x * next.y - next.x * current.y;
  }

  return Math.abs(sum) / 2;
}

/**
 * Closed perimeter in image pixels — same vertex cycle as shoelace
 * (`i → (i+1) % n`, including the closing edge back to the first point).
 * Requires at least 3 points; returns 0 otherwise.
 */
export function polygonPerimeterPx(points: readonly ImagePoint[]): number {
  if (points.length < 3) {
    return 0;
  }

  let total = 0;
  for (let i = 0; i < points.length; i += 1) {
    total += segmentLengthPx(points[i], points[(i + 1) % points.length]);
  }
  return total;
}

/**
 * Convert image-pixel length to real-world length.
 * `unitsPerPixel` is the sheet calibrationScale (e.g. ft/px).
 */
export function toRealLength(
  lengthPx: number,
  unitsPerPixel: number
): number {
  return lengthPx * unitsPerPixel;
}

/**
 * Convert image-pixel² area to real-world area.
 * Linear scale is units/px, so area scale is (units/px)².
 */
export function toRealArea(areaPx2: number, unitsPerPixel: number): number {
  return areaPx2 * unitsPerPixel * unitsPerPixel;
}

export function areaUnitLabel(linearUnit: string): string {
  return `${linearUnit}²`;
}

export interface SolvedCircle {
  center: ImagePoint;
  /** Radius in image pixels. */
  radiusPx: number;
}

/**
 * Circle from center + a point on the circumference (2-point).
 * Returns null if radius is zero.
 */
export function circleFromCenterRadius(
  center: ImagePoint,
  rim: ImagePoint
): SolvedCircle | null {
  const radiusPx = segmentLengthPx(center, rim);
  if (!(radiusPx > 0)) return null;
  return { center, radiusPx };
}

/**
 * Unique circle through three non-collinear circumference points.
 * Returns null if points are collinear or coincident.
 *
 * Circumcenter via perpendicular-bisector intersection (determinant form).
 */
export function circleFrom3Points(
  a: ImagePoint,
  b: ImagePoint,
  c: ImagePoint
): SolvedCircle | null {
  const D =
    2 *
    (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(D) < 1e-12) return null;

  const a2 = a.x * a.x + a.y * a.y;
  const b2 = b.x * b.x + b.y * b.y;
  const c2 = c.x * c.x + c.y * c.y;

  const ux =
    (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / D;
  const uy =
    (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / D;

  const center = { x: ux, y: uy };
  const radiusPx = segmentLengthPx(center, a);
  if (!(radiusPx > 0)) return null;
  return { center, radiusPx };
}

/** Full-circle area in pixel²: π r². */
export function circleAreaPx2(radiusPx: number): number {
  if (!(radiusPx > 0)) return 0;
  return Math.PI * radiusPx * radiusPx;
}

/**
 * Signed turn from vector OA to OB in radians, range (−π, π].
 * Uses atan2(cross, dot) — not an approximation.
 */
export function signedAngleRad(
  origin: ImagePoint,
  a: ImagePoint,
  b: ImagePoint
): number {
  const ax = a.x - origin.x;
  const ay = a.y - origin.y;
  const bx = b.x - origin.x;
  const by = b.y - origin.y;
  return Math.atan2(ax * by - ay * bx, ax * bx + ay * by);
}

/**
 * Absolute angle between two rays from `vertex` through `a` and `b`,
 * in degrees, range [0, 180].
 */
export function angleDegrees(
  vertex: ImagePoint,
  a: ImagePoint,
  b: ImagePoint
): number | null {
  const ax = a.x - vertex.x;
  const ay = a.y - vertex.y;
  const bx = b.x - vertex.x;
  const by = b.y - vertex.y;
  const magA = Math.hypot(ax, ay);
  const magB = Math.hypot(bx, by);
  if (!(magA > 0) || !(magB > 0)) return null;

  const rad = Math.abs(Math.atan2(ax * by - ay * bx, ax * bx + ay * by));
  // Clamp numeric noise to [0, 180]
  const deg = (rad * 180) / Math.PI;
  return Math.min(180, Math.max(0, deg));
}

export interface SolvedArc {
  center: ImagePoint;
  radiusPx: number;
  /** Central angle of the arc that passes through `through`, radians (0, 2π]. */
  sweepRad: number;
  /** Arc length in pixels: r × sweepRad. */
  lengthPx: number;
}

/**
 * Arc through three circumference points: start → through → end.
 * Solves the circle, then takes the central sweep from start to end
 * that contains `through`.
 */
export function arcFrom3Points(
  start: ImagePoint,
  through: ImagePoint,
  end: ImagePoint
): SolvedArc | null {
  const circle = circleFrom3Points(start, through, end);
  if (!circle) return null;

  const { center, radiusPx } = circle;
  const angStart = Math.atan2(start.y - center.y, start.x - center.x);
  const angThrough = Math.atan2(through.y - center.y, through.x - center.x);
  const angEnd = Math.atan2(end.y - center.y, end.x - center.x);

  const sweepCcw = normalizeSweep(angEnd - angStart);
  const throughCcw = normalizeTau(angThrough - angStart);

  // through lies on the CCW arc start→end iff 0 ≤ throughCcw ≤ sweepCcw
  const onCcw = throughCcw <= sweepCcw + 1e-10;
  let sweepRad = onCcw ? sweepCcw : 2 * Math.PI - sweepCcw;
  if (sweepRad < 1e-12) sweepRad = 2 * Math.PI;

  const lengthPx = radiusPx * sweepRad;
  if (!(lengthPx > 0)) return null;
  return { center, radiusPx, sweepRad, lengthPx };
}

/** Map angle difference into [0, 2π). */
function normalizeTau(rad: number): number {
  const twoPi = 2 * Math.PI;
  let x = rad % twoPi;
  if (x < 0) x += twoPi;
  return x;
}

/** Sweep magnitude: identical angles → full turn 2π; else (0, 2π). */
function normalizeSweep(rad: number): number {
  const x = normalizeTau(rad);
  return x === 0 ? 2 * Math.PI : x;
}

/**
 * Evaluate a Bézier curve at parameter t ∈ [0, 1] (De Casteljau).
 * `controls` are the clicked control polygon (degree = n−1).
 */
export function bezierPointAt(
  controls: readonly ImagePoint[],
  t: number
): ImagePoint | null {
  if (controls.length === 0) return null;
  if (controls.length === 1) return { ...controls[0] };

  let pts = controls.map((p) => ({ x: p.x, y: p.y }));
  for (let r = 1; r < controls.length; r += 1) {
    const next: ImagePoint[] = [];
    for (let i = 0; i < pts.length - 1; i += 1) {
      next.push({
        x: (1 - t) * pts[i].x + t * pts[i + 1].x,
        y: (1 - t) * pts[i].y + t * pts[i + 1].y,
      });
    }
    pts = next;
  }
  return pts[0] ?? null;
}

/**
 * Approximate arc length of a Bézier whose control polygon is `controls`.
 *
 * Documented assumption (same honesty class as spiral/helical average-radius
 * development and orthogonal-grid diagonal lengths): the true curve length has
 * no closed form for arbitrary degree, so we sample the curve at `sampleCount`
 * equal parameter steps and sum chord lengths. More samples → closer to the
 * analytic length; this is an estimating approximation, not an exact integral.
 * Default 64 samples is a deliberate resolution trade-off.
 */
export function bezierLengthPx(
  controls: readonly ImagePoint[],
  sampleCount = 64
): number {
  if (controls.length < 2) return 0;
  const n = Math.max(2, Math.floor(sampleCount));
  let total = 0;
  let prev = bezierPointAt(controls, 0);
  if (!prev) return 0;
  for (let i = 1; i <= n; i += 1) {
    const t = i / n;
    const cur = bezierPointAt(controls, t);
    if (!cur) break;
    total += segmentLengthPx(prev, cur);
    prev = cur;
  }
  return total;
}

/**
 * Net area after subtractive deductions: max(0, gross − Σ deductions).
 * Hand-check: gross 10, deductions [2, 1.5] → 6.5.
 */
export function netAreaAfterDeductions(
  grossArea: number,
  deductionAreas: readonly number[]
): number {
  if (!(grossArea >= 0) || !Number.isFinite(grossArea)) return 0;
  let sum = 0;
  for (const d of deductionAreas) {
    if (Number.isFinite(d) && d > 0) sum += d;
  }
  return Math.max(0, grossArea - sum);
}
