/** API-facing Project shape from the backend. */
export interface Project {
  id: string;
  name: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Real-world units per image pixel after calibration.
 * Null until the sheet is calibrated.
 */
export type CalibrationScale = number | null;

/** Supported real-world units for scale calibration. */
export type CalibrationUnitLabel = "ft" | "m" | "in";

/** e.g. "ft", "m"; null until calibrated. */
export type CalibrationUnit = CalibrationUnitLabel | string | null;

export type AiExtractionStatus =
  | "idle"
  | "pending"
  | "processing"
  | "completed"
  | "failed";

/** API-facing Sheet shape from the backend. */
export interface Sheet {
  id: string;
  projectId: string;
  floorId: string | null;
  name: string;
  originalFileUrl: string;
  thumbnailFileUrl: string | null;
  sourcePdfUrl: string | null;
  pageNumber: number;
  discipline: string;
  sortOrder: number;
  calibrationScale: CalibrationScale;
  calibrationUnit: CalibrationUnit;
  isFloorPlan: boolean | null;
  pageTitle: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  aiExtractionStatus: AiExtractionStatus;
  aiExtractionError: string | null;
}

export type AiSuggestionStatus = "PENDING" | "ACCEPTED" | "REJECTED";
export type AiSuggestionConfidence = "high" | "medium" | "low";

/** AI room suggestion — data-only; no canvas polygon. */
export interface AiSuggestion {
  id: string;
  sheetId: string;
  label: string;
  dimensionA: number | null;
  dimensionB: number | null;
  dimensionUnit: string;
  dimensionsRaw: string | null;
  calculatedArea: number | null;
  calculatedPerimeter: number | null;
  confidence: AiSuggestionConfidence;
  status: AiSuggestionStatus;
  takeoffItemId: string | null;
  approxX: number | null;
  approxY: number | null;
  confirmedX: number | null;
  confirmedY: number | null;
  promotedInstanceId: string | null;
}

export type TakeoffSource = "MANUAL" | "AI_SUGGESTED";

export type TakeoffType = "LINEAR" | "AREA" | "COUNT";

/** Vertex in source-image pixel space. */
export interface TakeoffPoint {
  x: number;
  y: number;
}

/** Project layer for grouping takeoff/markup (MongoDB Layer model). */
export interface Layer {
  id: string;
  projectId: string;
  name: string;
  color: string;
  visible: boolean;
  sortOrder: number;
}

/** Per-project unit cost catalog entry. */
export interface CostItem {
  id: string;
  projectId: string;
  name: string;
  category: string;
  unit: string;
  unitCost: number;
  notes: string | null;
}

/** Measurement type a condition/assembly applies to. */
export type ConditionAppliesToType = TakeoffType;

/** Cost item summary embedded on a condition line item. */
export interface ConditionLineCostItemSummary {
  id: string;
  name: string;
  category: string;
  unit: string;
  unitCost: number;
}

export interface ConditionLineItem {
  id: string;
  conditionId: string;
  costItemId: string;
  quantityPerUnit: number;
  costItem: ConditionLineCostItemSummary | null;
}

/** Assembly/recipe that converts measured quantity into priced materials. */
export interface Condition {
  id: string;
  projectId: string;
  name: string;
  appliesToType: ConditionAppliesToType;
  description: string | null;
  lineItems: ConditionLineItem[];
}

/** API-facing TakeoffItem shape from the backend. */
export interface TakeoffItem {
  id: string;
  sheetId: string;
  type: TakeoffType;
  /** Null for AI-accepted rooms with no traced geometry. */
  points: TakeoffPoint[] | null;
  calculatedValue: number;
  perimeter: number | null;
  unit: string;
  label: string | null;
  color: string;
  source: TakeoffSource;
  /** null → UI "Uncategorized" fallback (not a DB row). */
  layerId: string | null;
  /** null → not priced yet (no condition assigned). */
  conditionId: string | null;
  confirmedX: number | null;
  confirmedY: number | null;
  promotedInstanceId: string | null;
}

/** One takeoff row in the project cost summary. */
export interface CostSummaryItem {
  takeoffItemId: string;
  sheetId: string;
  sheetName: string;
  label: string | null;
  type: string;
  calculatedValue: number;
  unit: string;
  priced: boolean;
  conditionId: string | null;
  conditionName: string | null;
  costPerUnit: number | null;
  totalCost: number | null;
  status: "priced" | "not_priced";
  lineBreakdown: Array<{
    costItemId: string;
    costItemName: string;
    category: string;
    quantityPerUnit: number;
    unitCost: number;
    extendedQuantity: number;
    extendedCost: number;
  }>;
}

export interface CostSummaryGroup {
  key: string;
  name: string;
  itemCount: number;
  subtotal: number;
}

export interface CostSummaryLegendEntry {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  sortOrder: number;
}

export interface CostSummary {
  items: CostSummaryItem[];
  byCondition: CostSummaryGroup[];
  byCategory: CostSummaryGroup[];
  grandTotal: number;
  pricedCount: number;
  unpricedCount: number;
  unpricedItems: CostSummaryItem[];
  legend: CostSummaryLegendEntry[];
}

export type MarkupType =
  | "FREEHAND"
  | "LINE"
  | "RECTANGLE"
  | "ELLIPSE"
  | "POLYGON"
  | "TEXT";

/** API-facing MarkupObject — annotation geometry, not a measured quantity. */
export interface MarkupObject {
  id: string;
  sheetId: string;
  type: MarkupType;
  /** Image-space geometry JSON; shape depends on `type`. */
  data: Record<string, unknown>;
  color: string;
  strokeWidth: number;
  textContent: string | null;
  /** null → UI "Uncategorized" fallback (not a DB row). */
  layerId: string | null;
}

/** Active drawing / navigation tool in the sheet viewer. */
export type ViewerTool =
  | "pan"
  | "select"
  | "calibrate"
  | "linear"
  | "area"
  | "count"
  | "freehand"
  | "markupLine"
  | "rectangle"
  | "ellipse"
  | "polygon"
  | "text";

/** Unified selection for takeoff items and markups. */
export type SelectedObject =
  | { kind: "takeoff"; id: string }
  | { kind: "markup"; id: string };
