import OpenSeadragon from "openseadragon";

/** A point in image pixel space (origin top-left of the source PNG). */
export interface ImagePoint {
  x: number;
  y: number;
}

/** A point in viewer-element CSS pixel space (origin top-left of the OSD div). */
export interface ScreenPoint {
  x: number;
  y: number;
}

/**
 * Convert a pointer event on the OpenSeadragon viewer into image coordinates.
 *
 * Why this matters for calibration:
 * Scale must be "real-world units per image pixel". Image pixels are fixed for
 * the PNG; screen pixels change whenever the user pans or zooms. If we measured
 * distance in screen space, the same wall would appear longer when zoomed in.
 *
 * Conversion chain (OpenSeadragon):
 * 1. Browser event → element-local CSS pixels
 *    (clientX/Y minus the viewer element's bounding rect).
 * 2. Element pixels → viewport coordinates
 *    via `viewport.pointFromPixel(point, true)`.
 *    Viewport space is OSD's normalized zoom/pan space.
 * 3. Viewport coordinates → image pixel coordinates
 *    via `viewport.viewportToImageCoordinates(...)`.
 *    Result is in the source image's pixel grid, zoom-independent.
 */
export function screenEventToImagePoint(
  viewer: OpenSeadragon.Viewer,
  clientX: number,
  clientY: number
): ImagePoint | null {
  const element = viewer.element;
  if (!element) {
    return null;
  }

  const rect = element.getBoundingClientRect();
  const screenX = clientX - rect.left;
  const screenY = clientY - rect.top;

  const viewportPoint = viewer.viewport.pointFromPixel(
    new OpenSeadragon.Point(screenX, screenY),
    true
  );
  const imagePoint = viewer.viewport.viewportToImageCoordinates(viewportPoint);

  return { x: imagePoint.x, y: imagePoint.y };
}

/**
 * Inverse of screen→image: project an image pixel back to element CSS pixels
 * so Konva overlays stay glued to the blueprint while the user pans/zooms.
 *
 * Chain: image → viewport (`imageToViewportCoordinates`) → element pixels
 * (`pixelFromPoint`).
 */
export function imagePointToScreenPoint(
  viewer: OpenSeadragon.Viewer,
  point: ImagePoint
): ScreenPoint {
  const viewportPoint = viewer.viewport.imageToViewportCoordinates(
    point.x,
    point.y
  );
  const pixel = viewer.viewport.pixelFromPoint(viewportPoint, true);
  return { x: pixel.x, y: pixel.y };
}

/** Element-local CSS pixels → image pixels (same chain as screenEventToImagePoint). */
export function elementPixelToImagePoint(
  viewer: OpenSeadragon.Viewer,
  screenX: number,
  screenY: number
): ImagePoint {
  const viewportPoint = viewer.viewport.pointFromPixel(
    new OpenSeadragon.Point(screenX, screenY),
    true
  );
  const imagePoint = viewer.viewport.viewportToImageCoordinates(viewportPoint);
  return { x: imagePoint.x, y: imagePoint.y };
}

/**
 * Convert a screen-space drag delta (CSS pixels) into an image-space delta
 * so moved markups stay correct at the current zoom level.
 */
export function screenDeltaToImageDelta(
  viewer: OpenSeadragon.Viewer,
  dx: number,
  dy: number
): ImagePoint {
  const origin = elementPixelToImagePoint(viewer, 0, 0);
  const moved = elementPixelToImagePoint(viewer, dx, dy);
  return { x: moved.x - origin.x, y: moved.y - origin.y };
}

/** Euclidean distance in image pixel space. */
export function imagePixelDistance(a: ImagePoint, b: ImagePoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.hypot(dx, dy);
}

/**
 * Scale = real-world length / image-pixel length.
 * Stored on the Sheet as units-per-pixel (e.g. ft/px).
 */
export function computeCalibrationScale(
  realWorldDistance: number,
  pixelDistance: number
): number {
  if (!(realWorldDistance > 0) || !(pixelDistance > 0)) {
    throw new Error("Distances must be positive to compute scale");
  }
  return realWorldDistance / pixelDistance;
}
