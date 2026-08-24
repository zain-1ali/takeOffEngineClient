/**
 * Unit helpers for AI-extracted metric room data → project display units.
 * Supports meters and millimeters; default display is imperial (ft / sq ft).
 */

export type UnitSystem = "imperial" | "metric";

export const METERS_TO_FEET = 3.280839895;
export const SQ_METERS_TO_SQ_FEET = METERS_TO_FEET * METERS_TO_FEET;
export const MM_TO_FEET = METERS_TO_FEET / 1000;
export const SQ_MM_TO_SQ_FEET = MM_TO_FEET * MM_TO_FEET;

/** Default until a project-level unitSystem setting exists. */
export const DEFAULT_UNIT_SYSTEM: UnitSystem = "imperial";

export function metersToFeet(meters: number): number {
  return meters * METERS_TO_FEET;
}

export function sqMetersToSqFeet(sqMeters: number): number {
  return sqMeters * SQ_METERS_TO_SQ_FEET;
}

function isMmUnit(unit: string): boolean {
  const u = unit.trim().toLowerCase();
  return (
    u === "mm" ||
    u === "millimeter" ||
    u === "millimeters" ||
    u === "mm²" ||
    u === "mm2"
  );
}

function isMeterUnit(unit: string): boolean {
  const u = unit.trim().toLowerCase();
  return (
    u === "" ||
    u === "m" ||
    u === "meter" ||
    u === "meters" ||
    u === "m²" ||
    u === "m2"
  );
}

export function formatLength(
  value: number,
  system: UnitSystem = DEFAULT_UNIT_SYSTEM,
  sourceUnit = "m"
): string {
  if (system === "metric") {
    if (isMmUnit(sourceUnit)) {
      return `${trimNumber(value)} mm`;
    }
    return `${trimNumber(value)} m`;
  }
  if (isMmUnit(sourceUnit)) {
    return `${trimNumber(value * MM_TO_FEET)} ft`;
  }
  return `${trimNumber(metersToFeet(value))} ft`;
}

export function formatArea(
  value: number,
  system: UnitSystem = DEFAULT_UNIT_SYSTEM,
  sourceUnit = "m"
): string {
  if (system === "metric") {
    if (isMmUnit(sourceUnit)) {
      return `${trimNumber(value)} mm²`;
    }
    return `${trimNumber(value)} m²`;
  }
  if (isMmUnit(sourceUnit)) {
    return `${trimNumber(value * SQ_MM_TO_SQ_FEET)} sq ft`;
  }
  return `${trimNumber(sqMetersToSqFeet(value))} sq ft`;
}

/** e.g. "12.4 ft × 9.4 ft" from mm/m source dims. */
export function formatDimensionPair(
  a: number | null,
  b: number | null,
  sourceUnit: string,
  system: UnitSystem = DEFAULT_UNIT_SYSTEM
): string {
  if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b)) {
    return "—";
  }

  if (system === "imperial") {
    if (isMmUnit(sourceUnit)) {
      return `${trimNumber(a * MM_TO_FEET)} ft × ${trimNumber(b * MM_TO_FEET)} ft`;
    }
    if (isMeterUnit(sourceUnit)) {
      return `${trimNumber(metersToFeet(a))} ft × ${trimNumber(metersToFeet(b))} ft`;
    }
    return `${trimNumber(a)} × ${trimNumber(b)}`;
  }

  if (isMmUnit(sourceUnit)) {
    return `${trimNumber(a)} mm × ${trimNumber(b)} mm`;
  }
  return `${trimNumber(a)} m × ${trimNumber(b)} m`;
}

function trimNumber(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toFixed(1).replace(/\.0$/, "");
}
