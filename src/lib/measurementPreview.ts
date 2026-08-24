import {
  areaUnitLabel,
  polygonAreaPx2,
  polylineLengthPx,
  toRealArea,
  toRealLength,
  type ImagePoint,
} from "./measurementMath";
import type { TakeoffType } from "../types/models";

export interface MeasurementPreview {
  value: number;
  unit: string;
}

/**
 * Client-side preview of what the backend will store for a takeoff item.
 * LINEAR/AREA require a positive calibration scale (units per pixel).
 */
export function previewTakeoffMeasurement(
  type: TakeoffType,
  points: readonly ImagePoint[],
  calibrationScale: number | null | undefined,
  calibrationUnit: string | null | undefined
): MeasurementPreview | null {
  if (type === "COUNT") {
    return { value: points.length, unit: "ea" };
  }

  if (
    calibrationScale == null ||
    !(calibrationScale > 0) ||
    !calibrationUnit
  ) {
    return null;
  }

  if (type === "LINEAR") {
    if (points.length < 2) {
      return null;
    }
    return {
      value: toRealLength(polylineLengthPx(points), calibrationScale),
      unit: calibrationUnit,
    };
  }

  // AREA — pixel² × scale²
  if (points.length < 3) {
    return null;
  }
  return {
    value: toRealArea(polygonAreaPx2(points), calibrationScale),
    unit: areaUnitLabel(calibrationUnit),
  };
}
