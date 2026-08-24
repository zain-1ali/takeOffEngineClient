import type { ImagePoint } from "./osdCoordinates";
import type { MarkupType } from "../types/models";

/** Freehand stroke in image space. */
export interface FreehandData {
  points: ImagePoint[];
}

/** Closed polygon vertices in image space (markup, not measured). */
export interface PolygonData {
  points: ImagePoint[];
}

/** Straight line endpoints in image space. */
export interface LineData {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Axis-aligned rectangle (top-left + size) in image space. */
export interface RectangleData {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Ellipse defined by center + radii in image space. */
export interface EllipseData {
  cx: number;
  cy: number;
  radiusX: number;
  radiusY: number;
}

/** Text anchor point in image space (content lives on textContent). */
export interface TextData {
  x: number;
  y: number;
}

export type MarkupGeometry =
  | FreehandData
  | PolygonData
  | LineData
  | RectangleData
  | EllipseData
  | TextData;

/** Normalize a dragged rectangle so width/height are positive. */
export function normalizeRectangle(
  x0: number,
  y0: number,
  x1: number,
  y1: number
): RectangleData {
  const x = Math.min(x0, x1);
  const y = Math.min(y0, y1);
  return {
    x,
    y,
    width: Math.abs(x1 - x0),
    height: Math.abs(y1 - y0),
  };
}

export function ellipseFromCorners(
  x0: number,
  y0: number,
  x1: number,
  y1: number
): EllipseData {
  const rect = normalizeRectangle(x0, y0, x1, y1);
  return {
    cx: rect.x + rect.width / 2,
    cy: rect.y + rect.height / 2,
    radiusX: rect.width / 2,
    radiusY: rect.height / 2,
  };
}

/** Translate markup geometry by an image-space delta (used for drag-move). */
export function translateMarkupData(
  type: MarkupType,
  data: MarkupGeometry,
  dx: number,
  dy: number
): MarkupGeometry {
  switch (type) {
    case "FREEHAND":
    case "POLYGON": {
      const poly = data as FreehandData | PolygonData;
      return {
        points: poly.points.map((point) => ({
          x: point.x + dx,
          y: point.y + dy,
        })),
      };
    }
    case "LINE": {
      const line = data as LineData;
      return {
        x1: line.x1 + dx,
        y1: line.y1 + dy,
        x2: line.x2 + dx,
        y2: line.y2 + dy,
      };
    }
    case "RECTANGLE": {
      const rect = data as RectangleData;
      return {
        x: rect.x + dx,
        y: rect.y + dy,
        width: rect.width,
        height: rect.height,
      };
    }
    case "ELLIPSE": {
      const ellipse = data as EllipseData;
      return {
        cx: ellipse.cx + dx,
        cy: ellipse.cy + dy,
        radiusX: ellipse.radiusX,
        radiusY: ellipse.radiusY,
      };
    }
    case "TEXT": {
      const text = data as TextData;
      return { x: text.x + dx, y: text.y + dy };
    }
    default:
      return data;
  }
}
