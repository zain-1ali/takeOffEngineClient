import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import OpenSeadragon from "openseadragon";
import "../lib/konvaSetup";
import {
  Stage,
  Layer,
  Line,
  Circle,
  Text,
  Group,
  Rect,
  Ellipse,
} from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type Konva from "konva";
import {
  imagePointToScreenPoint,
  screenDeltaToImageDelta,
  screenEventToImagePoint,
  type ImagePoint,
  type ScreenPoint,
} from "../lib/osdCoordinates";
import {
  arcFrom3Points,
  bezierPointAt,
  circleFrom3Points,
  circleFromCenterRadius,
} from "../lib/measurementMath";
import type { MeasureSessionOverlay } from "../lib/measureSessionOverlays";
import {
  ellipseFromCorners,
  normalizeRectangle,
  translateMarkupData,
  type EllipseData,
  type FreehandData,
  type LineData,
  type MarkupGeometry,
  type PolygonData,
  type RectangleData,
  type TextData,
} from "../lib/markupGeometry";
import type {
  AiSuggestion,
  Layer as LayerType,
  MarkupObject,
  SelectedObject,
  TakeoffItem,
  ViewerTool,
} from "../types/models";
import { AiRoomPinPopover } from "./AiRoomPinPopover";
import { getColorForItem } from "../lib/itemLayerColor";

/** Calibration draft only — measurements use `markupStyle.color` (shared tool color). */
const CALIBRATE_COLOR = "#e29a12";

export interface AiRoomPin {
  suggestion: AiSuggestion;
  imagePoint: ImagePoint;
}

export interface MarkupStyle {
  color: string;
  strokeWidth: number;
}

export interface SheetViewerProps {
  imageUrl: string;
  className?: string;
  tool?: ViewerTool;
  layers?: LayerType[];
  takeoffItems?: TakeoffItem[];
  markupObjects?: MarkupObject[];
  selectedObject?: SelectedObject | null;
  markupStyle?: MarkupStyle;
  onSelectObject?: (selection: SelectedObject | null) => void;
  onCalibrationMeasured?: (payload: {
    pointA: ImagePoint;
    pointB: ImagePoint;
    pixelDistance: number;
  }) => void;
  onMeasurementComplete?: (payload: {
    type: "LINEAR" | "AREA" | "COUNT" | "CIRCLE" | "ARC" | "ANGLE" | "CURVED_PATH" | "DEDUCTION";
    points: ImagePoint[];
    color: string;
    /** Screen-space anchor for the label popup (near the finished shape). */
    anchorScreen?: ScreenPoint;
  }) => void;
  /**
   * Live draft while tracing (polyline running total, area rubber-band, etc.).
   * `null` when the draft is cleared or the tool changes.
   */
  onDraftMeasureChange?: (draft: {
    tool: ViewerTool;
    points: ImagePoint[];
    cursor: ImagePoint | null;
  } | null) => void;
  onMarkupCreate?: (payload: {
    type: MarkupObject["type"];
    data: MarkupGeometry;
    color: string;
    strokeWidth: number;
    textContent?: string | null;
  }) => void;
  /** Called when geometry changes (e.g. drag). Parent should debounce API writes. */
  onMarkupUpdate?: (
    id: string,
    patch: { data: MarkupGeometry; textContent?: string | null },
    previous: MarkupObject
  ) => void;
  onTextPlace?: (point: ImagePoint) => void;
  /** When true, ignore new measure/markup pointer input (e.g. while naming). */
  inputBlocked?: boolean;
  /** Ghost takeoff drawn while the name prompt is open. */
  previewMeasurement?: {
    type: "LINEAR" | "AREA" | "COUNT";
    points: ImagePoint[];
    color: string;
  } | null;
  /**
   * Persistent measure-session overlays (survive after a trace finishes).
   * Hidden items (`visible: false`) are omitted.
   */
  sessionOverlays?: MeasureSessionOverlay[];
  /** Human-confirmed AI room pins (confirmedX/Y on suggestion). */
  aiRoomPins?: AiRoomPin[];
  showAiRoomPins?: boolean;
  selectedAiRoomPinId?: string | null;
  onSelectAiRoomPin?: (id: string | null) => void;
  /** Accept flow: user clicks once on the blueprint to confirm room location. */
  clickToLocate?: { roomLabel: string } | null;
  onClickToLocate?: (point: ImagePoint) => void;
}

type MarkupDraft =
  | { type: "FREEHAND"; points: ImagePoint[] }
  | { type: "LINE"; start: ImagePoint; end: ImagePoint }
  | { type: "RECTANGLE"; start: ImagePoint; end: ImagePoint }
  | { type: "ELLIPSE"; start: ImagePoint; end: ImagePoint };

function flattenScreenPoints(points: ScreenPoint[]): number[] {
  const flat: number[] = [];
  for (const point of points) {
    flat.push(point.x, point.y);
  }
  return flat;
}

/** Drag-to-draw markup tools (mousedown → move → mouseup). */
function isDragDrawTool(tool: ViewerTool): boolean {
  return (
    tool === "freehand" ||
    tool === "markupLine" ||
    tool === "rectangle" ||
    tool === "measureRect" ||
    tool === "ellipse"
  );
}

/** Click-to-trace tools (vertices, finish via double-click / Enter / close). */
function isClickTraceTool(tool: ViewerTool): boolean {
  return (
    tool === "linear" ||
    tool === "polyline" ||
    tool === "curvedPath" ||
    tool === "area" ||
    tool === "polygon" ||
    tool === "circle" ||
    tool === "circle3" ||
    tool === "arc" ||
    tool === "angle" ||
    tool === "deduction"
  );
}

/** Screen-space proximity to close a polygon by clicking near the first vertex. */
const CLOSE_POLYGON_THRESHOLD_PX = 10;

function rectCorners(rect: {
  x: number;
  y: number;
  width: number;
  height: number;
}): ImagePoint[] {
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ];
}

function isNearPointScreen(
  viewer: OpenSeadragon.Viewer,
  a: ImagePoint,
  b: ImagePoint,
  thresholdPx: number
): boolean {
  const sa = imagePointToScreenPoint(viewer, a);
  const sb = imagePointToScreenPoint(viewer, b);
  return Math.hypot(sa.x - sb.x, sa.y - sb.y) <= thresholdPx;
}

/**
 * OpenSeadragon blueprint viewer with Konva overlay for calibration,
 * takeoff measurements, and markup annotations (all in image coordinates).
 */
export function SheetViewer({
  imageUrl,
  className,
  tool = "pan",
  layers = [],
  takeoffItems = [],
  markupObjects = [],
  selectedObject = null,
  markupStyle = { color: "#c2410c", strokeWidth: 3 },
  onSelectObject,
  onCalibrationMeasured,
  onMeasurementComplete,
  onDraftMeasureChange,
  onMarkupCreate,
  onMarkupUpdate,
  onTextPlace,
  inputBlocked = false,
  previewMeasurement = null,
  sessionOverlays = [],
  aiRoomPins = [],
  showAiRoomPins = true,
  selectedAiRoomPinId = null,
  onSelectAiRoomPin,
  clickToLocate = null,
  onClickToLocate,
}: SheetViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<OpenSeadragon.Viewer | null>(null);
  const draftPointsRef = useRef<ImagePoint[]>([]);
  const takeoffItemsRef = useRef(takeoffItems);
  const layersRef = useRef(layers);
  const markupObjectsRef = useRef(markupObjects);
  const aiRoomPinsRef = useRef(aiRoomPins);
  const markupDraftRef = useRef<MarkupDraft | null>(null);
  const drawingRef = useRef(false);
  const inputBlockedRef = useRef(inputBlocked);
  const markupStyleRef = useRef(markupStyle);

  const onCalibrationRef = useRef(onCalibrationMeasured);
  const onMeasurementRef = useRef(onMeasurementComplete);
  const onDraftMeasureChangeRef = useRef(onDraftMeasureChange);
  const onMarkupCreateRef = useRef(onMarkupCreate);
  const onMarkupUpdateRef = useRef(onMarkupUpdate);
  const onSelectRef = useRef(onSelectObject);
  const onTextPlaceRef = useRef(onTextPlace);
  const onSelectAiRoomPinRef = useRef(onSelectAiRoomPin);
  const onClickToLocateRef = useRef(onClickToLocate);

  onCalibrationRef.current = onCalibrationMeasured;
  onMeasurementRef.current = onMeasurementComplete;
  onDraftMeasureChangeRef.current = onDraftMeasureChange;
  onMarkupCreateRef.current = onMarkupCreate;
  onMarkupUpdateRef.current = onMarkupUpdate;
  onSelectRef.current = onSelectObject;
  onTextPlaceRef.current = onTextPlace;
  onSelectAiRoomPinRef.current = onSelectAiRoomPin;
  onClickToLocateRef.current = onClickToLocate;
  takeoffItemsRef.current = takeoffItems;
  layersRef.current = layers;
  markupObjectsRef.current = markupObjects;
  aiRoomPinsRef.current = aiRoomPins;
  inputBlockedRef.current = inputBlocked;
  markupStyleRef.current = markupStyle;

  const [size, setSize] = useState({ width: 0, height: 0 });
  const [draftPoints, setDraftPoints] = useState<ImagePoint[]>([]);
  const [draftScreen, setDraftScreen] = useState<ScreenPoint[]>([]);
  const [cursorScreen, setCursorScreen] = useState<ScreenPoint | null>(null);
  const [itemsScreen, setItemsScreen] = useState<
    Array<{
      id: string;
      type: TakeoffItem["type"];
      color: string;
      points: ScreenPoint[];
    }>
  >([]);
  const [aiPinScreen, setAiPinScreen] = useState<
    Array<{
      id: string;
      label: string;
      status: AiSuggestion["status"];
      x: number;
      y: number;
      suggestion: AiSuggestion;
    }>
  >([]);
  const [markupDraft, setMarkupDraft] = useState<MarkupDraft | null>(null);
  const [viewportTick, setViewportTick] = useState(0);
  /** Hold Space (or use Pan tool) to pan/zoom without drawing. */
  const [spacePan, setSpacePan] = useState(false);

  draftPointsRef.current = draftPoints;
  markupDraftRef.current = markupDraft;

  const projectItems = useCallback(
    (viewer: OpenSeadragon.Viewer, items: TakeoffItem[], layerList: LayerType[]) => {
      setItemsScreen(
        items
          .filter((item) => item.points != null && item.points.length > 0)
          .map((item) => ({
            id: item.id,
            type: item.type,
            color: getColorForItem(item, layerList).color,
            points: (item.points ?? []).map((point) =>
              imagePointToScreenPoint(viewer, point)
            ),
          }))
      );
    },
    []
  );

  const projectAiRoomPins = useCallback(
    (viewer: OpenSeadragon.Viewer, pins: AiRoomPin[]) => {
      setAiPinScreen(
        pins.map((pin) => {
          const screen = imagePointToScreenPoint(viewer, pin.imagePoint);
          return {
            id: pin.suggestion.id,
            label: pin.suggestion.label,
            status: pin.suggestion.status,
            x: screen.x,
            y: screen.y,
            suggestion: pin.suggestion,
          };
        })
      );
    },
    []
  );

  const projectDraft = useCallback(
    (viewer: OpenSeadragon.Viewer, points: ImagePoint[]) => {
      setDraftScreen(
        points.map((point) => imagePointToScreenPoint(viewer, point))
      );
    },
    []
  );

  useEffect(() => {
    const element = containerRef.current;
    if (!element || !imageUrl) {
      return;
    }

    let crossOrigin: false | "Anonymous" | "use-credentials" = false;
    try {
      const imageOrigin = new URL(imageUrl, window.location.href).origin;
      if (imageOrigin !== window.location.origin) {
        crossOrigin = "Anonymous";
      }
    } catch {
      crossOrigin = false;
    }

    const viewer = OpenSeadragon({
      element,
      // Custom HTML controls — OSD default PNGs are not shipped in the npm package.
      showNavigationControl: false,
      showNavigator: true,
      navigatorPosition: "BOTTOM_RIGHT",
      tileSources: { type: "image", url: imageUrl },
      crossOriginPolicy: crossOrigin,
      animationTime: 0.25,
      blendTime: 0.1,
      constrainDuringPan: true,
      maxZoomPixelRatio: 8,
      minZoomImageRatio: 0.5,
      visibilityRatio: 0.5,
      zoomPerScroll: 1.2,
      gestureSettingsMouse: {
        clickToZoom: false,
        dblClickToZoom: false,
        pinchToZoom: true,
        flickEnabled: true,
        scrollToZoom: true,
        dragToPan: true,
      },
      gestureSettingsTouch: {
        pinchToZoom: true,
        flickEnabled: true,
        clickToZoom: false,
        dblClickToZoom: false,
        dragToPan: true,
        scrollToZoom: true,
      },
      gestureSettingsPen: {
        dragToPan: true,
        scrollToZoom: true,
      },
    });

    viewerRef.current = viewer;

    const updateSize = (): void => {
      setSize({ width: element.clientWidth, height: element.clientHeight });
    };
    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(element);

    const onViewportChange = (): void => {
      projectItems(viewer, takeoffItemsRef.current, layersRef.current);
      projectAiRoomPins(viewer, aiRoomPinsRef.current);
      if (draftPointsRef.current.length > 0) {
        projectDraft(viewer, draftPointsRef.current);
      }
      setViewportTick((tick) => tick + 1);
    };

    viewer.addHandler("animation", onViewportChange);
    viewer.addHandler("animation-finish", onViewportChange);
    viewer.addHandler("resize", onViewportChange);
    viewer.addHandler("open", onViewportChange);

    return () => {
      resizeObserver.disconnect();
      viewer.destroy();
      viewerRef.current = null;
    };
  }, [imageUrl, projectDraft, projectItems, projectAiRoomPins]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (viewer) {
      projectItems(viewer, takeoffItems, layers);
    }
  }, [takeoffItems, layers, projectItems]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (viewer) {
      projectAiRoomPins(viewer, aiRoomPins);
    }
  }, [aiRoomPins, projectAiRoomPins]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.code !== "Space" || event.repeat) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      setSpacePan(true);
    }
    function onKeyUp(event: KeyboardEvent): void {
      if (event.code === "Space") setSpacePan(false);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", () => setSpacePan(false));
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) {
      return;
    }

    // Space (or Pan tool) lets drag-pan reach OSD; Konva overlay otherwise
    // captures clicks for measuring. Wheel zoom is forwarded from the Stage.
    const allowOsdPan = tool === "pan" || spacePan;
    viewer.setMouseNavEnabled(true);
    const gestures = viewer as OpenSeadragon.Viewer & {
      gestureSettingsMouse?: { dragToPan?: boolean; scrollToZoom?: boolean };
      gestureSettingsTouch?: { dragToPan?: boolean; pinchToZoom?: boolean };
    };
    if (gestures.gestureSettingsMouse) {
      gestures.gestureSettingsMouse.dragToPan = allowOsdPan;
      gestures.gestureSettingsMouse.scrollToZoom = true;
    }
    if (gestures.gestureSettingsTouch) {
      gestures.gestureSettingsTouch.dragToPan = allowOsdPan;
      gestures.gestureSettingsTouch.pinchToZoom = true;
    }
  }, [tool, spacePan]);

  useEffect(() => {
    if (clickToLocate) return;
    setDraftPoints([]);
    setDraftScreen([]);
    setCursorScreen(null);
    setMarkupDraft(null);
    drawingRef.current = false;
    onDraftMeasureChangeRef.current?.(null);
  }, [tool, clickToLocate]);

  /** Escape cancels an in-progress click-trace; Enter finishes polyline/area. */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.key === "Enter") {
        if (
          !inputBlockedRef.current &&
          (tool === "polyline" ||
            tool === "curvedPath" ||
            tool === "area" ||
            tool === "deduction" ||
            tool === "linear") &&
          draftPointsRef.current.length > 0
        ) {
          event.preventDefault();
          finishClickTrace();
        }
        return;
      }

      if (event.key !== "Escape") {
        return;
      }
      if (draftPointsRef.current.length === 0 && !markupDraftRef.current) {
        return;
      }
      event.preventDefault();
      setDraftPoints([]);
      setDraftScreen([]);
      setCursorScreen(null);
      setMarkupDraft(null);
      drawingRef.current = false;
      onDraftMeasureChangeRef.current?.(null);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // finishClickTrace closes over `tool`; re-bind when tool changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [tool]);

  function clearDraft(): void {
    setDraftPoints([]);
    setDraftScreen([]);
    setCursorScreen(null);
    onDraftMeasureChangeRef.current?.(null);
  }

  function emitDraftMeasure(
    points: ImagePoint[],
    cursor: ImagePoint | null = null
  ): void {
    if (points.length === 0) {
      onDraftMeasureChangeRef.current?.(null);
      return;
    }
    onDraftMeasureChangeRef.current?.({
      tool,
      points,
      cursor,
    });
  }

  function measurementAnchor(points: ImagePoint[]): ScreenPoint | undefined {
    const viewer = viewerRef.current;
    if (!viewer || points.length === 0) {
      return undefined;
    }
    // Prefer the last vertex — near where the user finished.
    return imagePointToScreenPoint(viewer, points[points.length - 1]);
  }

  function addMeasurePoint(imagePoint: ImagePoint): void {
    const viewer = viewerRef.current;
    if (!viewer) {
      return;
    }

    if (tool === "calibrate") {
      const next = [...draftPointsRef.current, imagePoint].slice(0, 2);
      setDraftPoints(next);
      projectDraft(viewer, next);
      if (next.length === 2) {
        onCalibrationRef.current?.({
          pointA: next[0],
          pointB: next[1],
          pixelDistance: Math.hypot(
            next[1].x - next[0].x,
            next[1].y - next[0].y
          ),
        });
      }
      return;
    }

    if (tool === "count") {
      onMeasurementRef.current?.({
        type: "COUNT",
        points: [imagePoint],
        color: markupStyleRef.current.color,
        anchorScreen: measurementAnchor([imagePoint]),
      });
      return;
    }

    if (
      tool === "linear" ||
      tool === "polyline" ||
      tool === "curvedPath" ||
      tool === "area" ||
      tool === "polygon" ||
      tool === "circle" ||
      tool === "circle3" ||
      tool === "arc" ||
      tool === "angle" ||
      tool === "deduction"
    ) {
      const existing = draftPointsRef.current;

      // Close irregular polygon by clicking near the first vertex again.
      if (
        (tool === "area" || tool === "polygon" || tool === "deduction") &&
        existing.length >= 3 &&
        isNearPointScreen(
          viewer,
          existing[0],
          imagePoint,
          CLOSE_POLYGON_THRESHOLD_PX
        )
      ) {
        finishClickTrace();
        return;
      }

      const next = [...existing, imagePoint];
      draftPointsRef.current = next;
      setDraftPoints(next);
      projectDraft(viewer, next);
      emitDraftMeasure(next, null);

      // Auto-finish by click count.
      if (tool === "linear" && next.length >= 2) {
        finishClickTrace();
      } else if (tool === "circle" && next.length >= 2) {
        finishClickTrace();
      } else if (
        (tool === "circle3" || tool === "arc" || tool === "angle") &&
        next.length >= 3
      ) {
        finishClickTrace();
      }
    }
  }

  function finishClickTrace(): void {
    const points = draftPointsRef.current;

    if ((tool === "linear" || tool === "polyline") && points.length >= 2) {
      const finished = [...points];
      onMeasurementRef.current?.({
        type: "LINEAR",
        points: finished,
        color: markupStyleRef.current.color,
        anchorScreen: measurementAnchor(finished),
      });
      clearDraft();
      return;
    }

    if (tool === "curvedPath" && points.length >= 2) {
      const finished = [...points];
      onMeasurementRef.current?.({
        type: "CURVED_PATH",
        points: finished,
        color: markupStyleRef.current.color,
        anchorScreen: measurementAnchor(finished),
      });
      clearDraft();
      return;
    }

    if (tool === "circle" && points.length >= 2) {
      const finished = points.slice(0, 2);
      onMeasurementRef.current?.({
        type: "CIRCLE",
        points: finished,
        color: markupStyleRef.current.color,
        anchorScreen: measurementAnchor(finished),
      });
      clearDraft();
      return;
    }

    if (tool === "circle3" && points.length >= 3) {
      const finished = points.slice(0, 3);
      onMeasurementRef.current?.({
        type: "CIRCLE",
        points: finished,
        color: markupStyleRef.current.color,
        anchorScreen: measurementAnchor(finished),
      });
      clearDraft();
      return;
    }

    if (tool === "arc" && points.length >= 3) {
      const finished = points.slice(0, 3);
      onMeasurementRef.current?.({
        type: "ARC",
        points: finished,
        color: markupStyleRef.current.color,
        anchorScreen: measurementAnchor(finished),
      });
      clearDraft();
      return;
    }

    if (tool === "angle" && points.length >= 3) {
      const finished = points.slice(0, 3);
      onMeasurementRef.current?.({
        type: "ANGLE",
        points: finished,
        color: markupStyleRef.current.color,
        anchorScreen: measurementAnchor(finished),
      });
      clearDraft();
      return;
    }

    if (tool === "deduction" && points.length >= 3) {
      const finished = [...points];
      onMeasurementRef.current?.({
        type: "DEDUCTION",
        points: finished,
        color: markupStyleRef.current.color,
        anchorScreen: measurementAnchor(finished),
      });
      clearDraft();
      return;
    }

    if (tool === "area" && points.length >= 3) {
      // Close polygon (last → first). Shoelace / perimeter use these vertices.
      const finished = [...points];
      onMeasurementRef.current?.({
        type: "AREA",
        points: finished,
        color: markupStyleRef.current.color,
        anchorScreen: measurementAnchor(finished),
      });
      clearDraft();
      return;
    }

    if (tool === "polygon" && points.length >= 3) {
      const style = markupStyleRef.current;
      onMarkupCreateRef.current?.({
        type: "POLYGON",
        data: { points: [...points] },
        color: style.color,
        strokeWidth: style.strokeWidth,
      });
      clearDraft();
    }
  }

  function beginMarkup(imagePoint: ImagePoint): void {
    drawingRef.current = true;
    if (tool === "freehand") {
      setMarkupDraft({ type: "FREEHAND", points: [imagePoint] });
    } else if (tool === "markupLine") {
      setMarkupDraft({ type: "LINE", start: imagePoint, end: imagePoint });
    } else if (tool === "rectangle" || tool === "measureRect") {
      setMarkupDraft({ type: "RECTANGLE", start: imagePoint, end: imagePoint });
      if (tool === "measureRect") {
        emitDraftMeasure([imagePoint, imagePoint], imagePoint);
      }
    } else if (tool === "ellipse") {
      setMarkupDraft({ type: "ELLIPSE", start: imagePoint, end: imagePoint });
    }
  }

  function updateMarkupDrag(imagePoint: ImagePoint): void {
    const draft = markupDraftRef.current;
    if (!draft || !drawingRef.current) {
      return;
    }

    if (draft.type === "FREEHAND") {
      const last = draft.points[draft.points.length - 1];
      if (
        last &&
        Math.hypot(imagePoint.x - last.x, imagePoint.y - last.y) < 1.5
      ) {
        return;
      }
      setMarkupDraft({
        type: "FREEHAND",
        points: [...draft.points, imagePoint],
      });
      return;
    }

    // measureRect: keep axis-aligned (ortho) corners via normalizeRectangle.
    setMarkupDraft({ ...draft, end: imagePoint });
    if (tool === "measureRect" && draft.type === "RECTANGLE") {
      const rect = normalizeRectangle(
        draft.start.x,
        draft.start.y,
        imagePoint.x,
        imagePoint.y
      );
      emitDraftMeasure(rectCorners(rect), imagePoint);
    }
  }

  function finishMarkup(): void {
    const draft = markupDraftRef.current;
    drawingRef.current = false;
    if (!draft) {
      return;
    }

    const color = markupStyleRef.current.color;
    const strokeWidth = markupStyleRef.current.strokeWidth;

    if (draft.type === "FREEHAND") {
      if (draft.points.length >= 2) {
        onMarkupCreateRef.current?.({
          type: "FREEHAND",
          data: { points: draft.points },
          color,
          strokeWidth,
        });
      }
    } else if (draft.type === "LINE") {
      onMarkupCreateRef.current?.({
        type: "LINE",
        data: {
          x1: draft.start.x,
          y1: draft.start.y,
          x2: draft.end.x,
          y2: draft.end.y,
        },
        color,
        strokeWidth,
      });
    } else if (draft.type === "RECTANGLE") {
      const rect = normalizeRectangle(
        draft.start.x,
        draft.start.y,
        draft.end.x,
        draft.end.y
      );
      if (rect.width > 1 && rect.height > 1) {
        if (tool === "measureRect") {
          const points = rectCorners(rect);
          onMeasurementRef.current?.({
            type: "AREA",
            points,
            color,
            anchorScreen: measurementAnchor(points),
          });
          onDraftMeasureChangeRef.current?.(null);
        } else {
          onMarkupCreateRef.current?.({
            type: "RECTANGLE",
            data: rect,
            color,
            strokeWidth,
          });
        }
      } else if (tool === "measureRect") {
        onDraftMeasureChangeRef.current?.(null);
      }
    } else if (draft.type === "ELLIPSE") {
      const ellipse = ellipseFromCorners(
        draft.start.x,
        draft.start.y,
        draft.end.x,
        draft.end.y
      );
      if (ellipse.radiusX > 1 && ellipse.radiusY > 1) {
        onMarkupCreateRef.current?.({
          type: "ELLIPSE",
          data: ellipse,
          color,
          strokeWidth,
        });
      }
    }

    setMarkupDraft(null);
  }

  function handleStageMouseDown(event: KonvaEventObject<MouseEvent>): void {
    if (event.evt.detail > 1) {
      return;
    }
    // Middle / right button — let the user pan (overlay ignores these).
    if (event.evt.button === 1 || event.evt.button === 2 || spacePan) {
      return;
    }

    const viewer = viewerRef.current;
    if (!viewer || tool === "pan" || inputBlockedRef.current) {
      return;
    }

    const imagePoint = screenEventToImagePoint(
      viewer,
      event.evt.clientX,
      event.evt.clientY
    );
    if (!imagePoint) {
      return;
    }

    if (tool === "select") {
      const targetName =
        typeof event.target.name === "function" ? event.target.name() : "";
      const clickedBackground =
        event.target === event.target.getStage() ||
        targetName === "stage-hit";
      if (clickedBackground) {
        onSelectRef.current?.(null);
      }
      return;
    }

    if (tool === "text") {
      onTextPlaceRef.current?.(imagePoint);
      return;
    }

    if (tool === "calibrate" || tool === "count" || isClickTraceTool(tool)) {
      if (tool === "calibrate" && draftPointsRef.current.length >= 2) {
        return;
      }
      addMeasurePoint(imagePoint);
      return;
    }

    if (isDragDrawTool(tool)) {
      beginMarkup(imagePoint);
    }
  }

  function handleStageMouseMove(event: KonvaEventObject<MouseEvent>): void {
    const viewer = viewerRef.current;
    if (!viewer) {
      return;
    }

    // Live rubber-band from last vertex to cursor while tracing.
    if (
      isClickTraceTool(tool) &&
      draftPointsRef.current.length > 0 &&
      !inputBlockedRef.current
    ) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setCursorScreen({
          x: event.evt.clientX - rect.left,
          y: event.evt.clientY - rect.top,
        });
      }
      const imagePoint = screenEventToImagePoint(
        viewer,
        event.evt.clientX,
        event.evt.clientY
      );
      if (
        imagePoint &&
        (tool === "polyline" ||
          tool === "curvedPath" ||
          tool === "area" ||
          tool === "deduction" ||
          tool === "circle" ||
          tool === "circle3" ||
          tool === "arc" ||
          tool === "angle")
      ) {
        emitDraftMeasure(draftPointsRef.current, imagePoint);
      }
    }

    if (!drawingRef.current || !isDragDrawTool(tool)) {
      return;
    }
    const imagePoint = screenEventToImagePoint(
      viewer,
      event.evt.clientX,
      event.evt.clientY
    );
    if (imagePoint) {
      updateMarkupDrag(imagePoint);
    }
  }

  function handleMarkupDragEnd(
    markup: MarkupObject,
    group: Konva.Group
  ): void {
    const viewer = viewerRef.current;
    if (!viewer) {
      return;
    }

    const dxScreen = group.x();
    const dyScreen = group.y();
    group.position({ x: 0, y: 0 });

    if (Math.abs(dxScreen) < 0.5 && Math.abs(dyScreen) < 0.5) {
      return;
    }

    const delta = screenDeltaToImageDelta(viewer, dxScreen, dyScreen);
    const nextData = translateMarkupData(
      markup.type,
      markup.data as unknown as MarkupGeometry,
      delta.x,
      delta.y
    );
    onMarkupUpdateRef.current?.(
      markup.id,
      {
        data: nextData,
        textContent: markup.textContent,
      },
      markup
    );
  }

  const overlayActive = tool !== "pan" && !clickToLocate && !spacePan;
  const viewer = viewerRef.current;
  void viewportTick;
  let countMarkerIndex = 0;

  const draftColor =
    tool === "calibrate" ? CALIBRATE_COLOR : markupStyle.color;

  const draftLine = flattenScreenPoints(draftScreen);

  const rubberBandPoints =
    cursorScreen &&
    draftScreen.length > 0 &&
    tool !== "circle" &&
    tool !== "circle3"
      ? [
          draftScreen[draftScreen.length - 1].x,
          draftScreen[draftScreen.length - 1].y,
          cursorScreen.x,
          cursorScreen.y,
        ]
      : tool === "angle" && cursorScreen && draftScreen.length === 1
        ? [
            draftScreen[0].x,
            draftScreen[0].y,
            cursorScreen.x,
            cursorScreen.y,
          ]
        : tool === "angle" && cursorScreen && draftScreen.length === 2
          ? [
              draftScreen[0].x,
              draftScreen[0].y,
              cursorScreen.x,
              cursorScreen.y,
            ]
          : tool === "circle" && cursorScreen && draftScreen.length === 1
            ? [
                draftScreen[0].x,
                draftScreen[0].y,
                cursorScreen.x,
                cursorScreen.y,
              ]
            : null;

  /** Live circle ghost (center+radius or solved 3-point). */
  const circleDraftScreen = (() => {
    if (tool === "circle" && draftScreen.length >= 1) {
      const c = draftScreen[0];
      const rim = draftScreen[1] ?? cursorScreen;
      if (!rim) return null;
      const radius = Math.hypot(rim.x - c.x, rim.y - c.y);
      if (!(radius > 1)) return null;
      return { x: c.x, y: c.y, radius };
    }
    if (tool === "circle3" && draftPoints.length >= 3 && viewer) {
      const solved = circleFrom3Points(
        draftPoints[0],
        draftPoints[1],
        draftPoints[2]
      );
      if (!solved) return null;
      const c = imagePointToScreenPoint(viewer, solved.center);
      const onCirc = imagePointToScreenPoint(viewer, draftPoints[0]);
      const radius = Math.hypot(onCirc.x - c.x, onCirc.y - c.y);
      if (!(radius > 1)) return null;
      return { x: c.x, y: c.y, radius };
    }
    if (tool === "arc" && draftPoints.length >= 3 && viewer) {
      const arc = arcFrom3Points(draftPoints[0], draftPoints[1], draftPoints[2]);
      if (!arc) return null;
      const c = imagePointToScreenPoint(viewer, arc.center);
      const onCirc = imagePointToScreenPoint(viewer, draftPoints[0]);
      const radius = Math.hypot(onCirc.x - c.x, onCirc.y - c.y);
      if (!(radius > 1)) return null;
      return { x: c.x, y: c.y, radius, dash: true as const };
    }
    return null;
  })();

  const angleRayPoints =
    tool === "angle" && draftScreen.length >= 2
      ? [
          draftScreen[1].x,
          draftScreen[1].y,
          draftScreen[0].x,
          draftScreen[0].y,
          (draftScreen[2] ?? cursorScreen)?.x ?? draftScreen[0].x,
          (draftScreen[2] ?? cursorScreen)?.y ?? draftScreen[0].y,
        ]
      : null;

  const closeHintActive =
    (tool === "area" || tool === "polygon" || tool === "deduction") &&
    draftScreen.length >= 3 &&
    cursorScreen != null &&
    Math.hypot(
      cursorScreen.x - draftScreen[0].x,
      cursorScreen.y - draftScreen[0].y
    ) <= CLOSE_POLYGON_THRESHOLD_PX;

  /** Sampled Bézier polyline for curved-path draft (screen space). */
  const curvedDraftFlat = (() => {
    if (tool !== "curvedPath" || draftPoints.length < 2 || !viewer) return null;
    const controls =
      cursorScreen && draftPoints.length >= 1
        ? [
            ...draftPoints,
            // Approximate cursor as extra control in image space via last rubber — skip if no image cursor
          ]
        : draftPoints;
    // Use draft points only for stable curve; rubber-band is separate.
    const samples: ScreenPoint[] = [];
    const n = 48;
    for (let i = 0; i <= n; i += 1) {
      const p = bezierPointAt(draftPoints, i / n);
      if (p) samples.push(imagePointToScreenPoint(viewer, p));
    }
    void controls;
    return flattenScreenPoints(samples);
  })();

  const previewScreen =
    viewer && previewMeasurement
      ? {
          type: previewMeasurement.type,
          color: previewMeasurement.color,
          points: previewMeasurement.points.map((point) =>
            imagePointToScreenPoint(viewer, point)
          ),
        }
      : null;

  const selectedPin = showAiRoomPins
    ? aiPinScreen.find((pin) => pin.id === selectedAiRoomPinId)
    : null;

  return (
    <div
      className={`relative ${className ?? ""}`}
      style={{ width: "100%", height: "100%" }}
    >
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />

      <div className="pointer-events-none absolute top-2 right-2 z-20 flex flex-col gap-1">
        {(
          [
            {
              label: "+",
              title: "Zoom in",
              action: () => {
                const v = viewerRef.current;
                if (!v?.viewport) return;
                v.viewport.zoomBy(1.25);
                v.viewport.applyConstraints();
              },
            },
            {
              label: "−",
              title: "Zoom out",
              action: () => {
                const v = viewerRef.current;
                if (!v?.viewport) return;
                v.viewport.zoomBy(0.8);
                v.viewport.applyConstraints();
              },
            },
            {
              label: "⌂",
              title: "Fit to view",
              action: () => {
                const v = viewerRef.current;
                if (!v?.viewport) return;
                v.viewport.goHome(true);
              },
            },
            {
              label: "⛶",
              title: "Toggle full page",
              action: () => {
                const v = viewerRef.current;
                if (!v) return;
                if (v.isFullPage()) v.setFullPage(false);
                else v.setFullPage(true);
              },
            },
          ] as const
        ).map((btn) => (
          <button
            key={btn.title}
            type="button"
            title={btn.title}
            aria-label={btn.title}
            className="pointer-events-auto flex h-8 w-8 items-center justify-center border border-steel-border bg-panel/95 text-base font-semibold text-ink shadow-sm hover:bg-bg"
            onClick={btn.action}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {spacePan || tool === "pan" ? (
        <div className="pointer-events-none absolute bottom-2 left-2 z-20 border border-steel-border bg-panel/90 px-2 py-1 text-[10px] text-steel">
          {spacePan ? "Space held — drag to pan · scroll to zoom" : "Pan mode · scroll to zoom"}
        </div>
      ) : overlayActive ? (
        <div className="pointer-events-none absolute bottom-2 left-2 z-20 border border-steel-border bg-panel/90 px-2 py-1 text-[10px] text-steel">
          Hold Space to pan · scroll / pinch to zoom
        </div>
      ) : null}

      {clickToLocate ? (
        <button
          type="button"
          className="absolute inset-0 z-[25] cursor-crosshair bg-cyan-500/5"
          aria-label={`Click on the blueprint where this room is: ${clickToLocate.roomLabel}`}
          onClick={(event) => {
            const viewer = viewerRef.current;
            if (!viewer) {
              return;
            }
            const point = screenEventToImagePoint(
              viewer,
              event.clientX,
              event.clientY
            );
            if (point) {
              onClickToLocateRef.current?.(point);
            }
          }}
        />
      ) : null}

      {showAiRoomPins && aiPinScreen.length > 0 ? (
        <div
          className="pointer-events-none absolute inset-0 z-[15]"
          aria-hidden={false}
        >
          {aiPinScreen.map((pin) => {
            const selected = selectedAiRoomPinId === pin.id;
            return (
              <button
                key={pin.id}
                type="button"
                title={pin.label}
                className="pointer-events-auto absolute -translate-x-1/2 -translate-y-full outline-none"
                style={{ left: pin.x, top: pin.y }}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectAiRoomPinRef.current?.(
                    selected ? null : pin.id
                  );
                  onSelectRef.current?.(null);
                }}
              >
                <span
                  className={`flex items-center gap-0.5 border border-cyan-400 bg-ink/90 px-1.5 py-0.5 font-display text-[0.55rem] font-extrabold tracking-wider uppercase text-cyan-50 shadow-md ${
                    selected ? "ring-2 ring-accent ring-offset-1 ring-offset-ink/80" : ""
                  }`}
                >
                  <span aria-hidden className="text-accent">
                    ✦
                  </span>
                  AI
                </span>
                <span
                  className="mx-auto block h-0 w-0 border-x-[5px] border-t-[6px] border-x-transparent border-t-cyan-400/90"
                  aria-hidden
                />
              </button>
            );
          })}

          {selectedPin ? (
            <>
              <button
                type="button"
                className="pointer-events-auto absolute inset-0 z-0 bg-transparent"
                aria-label="Close room details"
                onClick={() => onSelectAiRoomPinRef.current?.(null)}
              />
              <div
                className="pointer-events-auto absolute z-10"
                style={{
                  left: Math.min(
                    Math.max(12, selectedPin.x),
                    size.width - 200
                  ),
                  top: Math.max(12, selectedPin.y - 8),
                  transform: "translate(-50%, calc(-100% - 28px))",
                }}
              >
                <AiRoomPinPopover
                  suggestion={selectedPin.suggestion}
                  onClose={() => onSelectAiRoomPinRef.current?.(null)}
                />
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {size.width > 0 && size.height > 0 ? (
        <Stage
          width={size.width}
          height={size.height}
          className="absolute inset-0 z-10"
          style={{
            cursor: spacePan
              ? "grab"
              : tool === "select"
                ? "default"
                : overlayActive
                  ? "crosshair"
                  : "grab",
            pointerEvents: overlayActive ? "auto" : "none",
          }}
          onWheel={(event) => {
            const osd = viewerRef.current;
            if (!osd?.viewport) return;
            event.evt.preventDefault();
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect) return;

            // Trackpad two-finger horizontal → pan; vertical / pinch → zoom.
            if (
              !event.evt.ctrlKey &&
              Math.abs(event.evt.deltaX) > Math.abs(event.evt.deltaY) &&
              Math.abs(event.evt.deltaX) > 0
            ) {
              const delta = osd.viewport.deltaPointsFromPixels(
                new OpenSeadragon.Point(-event.evt.deltaX, -event.evt.deltaY),
              );
              osd.viewport.panBy(delta);
              osd.viewport.applyConstraints();
              return;
            }

            const pixel = new OpenSeadragon.Point(
              event.evt.clientX - rect.left,
              event.evt.clientY - rect.top,
            );
            const factor = event.evt.deltaY > 0 ? 1 / 1.2 : 1.2;
            osd.viewport.zoomBy(
              factor,
              osd.viewport.pointFromPixel(pixel, true),
            );
            osd.viewport.applyConstraints();
          }}
          onMouseDown={handleStageMouseDown}
          onMouseMove={handleStageMouseMove}
          onMouseUp={() => {
            if (isDragDrawTool(tool)) {
              finishMarkup();
            }
          }}
          onMouseLeave={() => {
            if (drawingRef.current && isDragDrawTool(tool)) {
              finishMarkup();
            }
          }}
          onTouchStart={(event) => {
            const touch = event.evt.changedTouches[0];
            if (!touch) {
              return;
            }
            // Reuse mouse-down path with synthesized client coords.
            handleStageMouseDown({
              ...event,
              evt: {
                ...event.evt,
                detail: 1,
                clientX: touch.clientX,
                clientY: touch.clientY,
              } as unknown as MouseEvent,
            } as KonvaEventObject<MouseEvent>);
          }}
          onTouchMove={(event) => {
            const touch = event.evt.changedTouches[0];
            if (!touch || !drawingRef.current) {
              return;
            }
            handleStageMouseMove({
              ...event,
              evt: {
                ...event.evt,
                clientX: touch.clientX,
                clientY: touch.clientY,
              } as unknown as MouseEvent,
            } as KonvaEventObject<MouseEvent>);
          }}
          onTouchEnd={() => {
            if (isDragDrawTool(tool)) {
              finishMarkup();
            }
          }}
          onDblClick={() => {
            if (!inputBlockedRef.current && isClickTraceTool(tool)) {
              finishClickTrace();
            }
          }}
        >
          {/* Full-stage hit target — empty canvas regions otherwise ignore pointer events. */}
          <Layer>
            <Rect
              name="stage-hit"
              x={0}
              y={0}
              width={size.width}
              height={size.height}
              fill="rgba(0,0,0,0)"
              listening={overlayActive}
            />
          </Layer>

          {/* Takeoff measurements */}
          <Layer listening={tool === "select"}>
            {itemsScreen.map((item) => {
              const flat = flattenScreenPoints(item.points);
              const selected =
                selectedObject?.kind === "takeoff" &&
                selectedObject.id === item.id;
              const selectHandlers = {
                onClick: (event: KonvaEventObject<MouseEvent>) => {
                  event.cancelBubble = true;
                  if (tool === "select") {
                    onSelectRef.current?.({ kind: "takeoff", id: item.id });
                  }
                },
                onTap: (event: KonvaEventObject<Event>) => {
                  event.cancelBubble = true;
                  if (tool === "select") {
                    onSelectRef.current?.({ kind: "takeoff", id: item.id });
                  }
                },
              };

              if (item.type === "LINEAR" && flat.length >= 4) {
                return (
                  <Group key={item.id} {...selectHandlers}>
                    <Line
                      points={flat}
                      stroke={item.color}
                      strokeWidth={selected ? 3 : 2}
                      dash={selected ? [8, 5] : undefined}
                      lineCap="round"
                      lineJoin="round"
                    />
                  </Group>
                );
              }
              if (item.type === "AREA" && flat.length >= 6) {
                return (
                  <Line
                    key={item.id}
                    points={flat}
                    stroke={item.color}
                    strokeWidth={selected ? 3 : 2}
                    dash={selected ? [8, 5] : undefined}
                    closed
                    fill={`${item.color}33`}
                    {...selectHandlers}
                  />
                );
              }
              if (item.type === "COUNT") {
                return (
                  <Group key={item.id} {...selectHandlers}>
                    {item.points.map((point, index) => {
                      countMarkerIndex += 1;
                      return (
                        <Group key={`${item.id}-${index}`}>
                          <Circle
                            x={point.x}
                            y={point.y}
                            radius={10}
                            fill={item.color}
                            stroke={selected ? "#ffffff" : "#0c1b2a"}
                            strokeWidth={selected ? 2 : 1}
                            dash={selected ? [4, 3] : undefined}
                          />
                          <Text
                            x={point.x - 10}
                            y={point.y - 5}
                            width={20}
                            align="center"
                            text={String(countMarkerIndex)}
                            fontSize={10}
                            fontStyle="bold"
                            fill="#0c1b2a"
                          />
                        </Group>
                      );
                    })}
                  </Group>
                );
              }
              return null;
            })}

            {/* Persistent measure-session overlays */}
            {viewer
              ? (() => {
                  let markerBase = 0;
                  return sessionOverlays
                    .filter((o) => o.visible && o.points.length > 0)
                    .map((overlay) => {
                      const node = renderSessionOverlay(
                        overlay,
                        viewer,
                        markerBase
                      );
                      if (overlay.kind === "COUNT") {
                        markerBase += overlay.points.length;
                      }
                      return node;
                    });
                })()
              : null}

            {previewScreen && previewScreen.points.length > 0 ? (
              previewScreen.type === "COUNT" ? (
                previewScreen.points.map((point, index) => (
                  <Circle
                    key={`preview-count-${index}`}
                    x={point.x}
                    y={point.y}
                    radius={10}
                    fill={previewScreen.color}
                    stroke="#ffffff"
                    strokeWidth={2}
                    dash={[4, 3]}
                    listening={false}
                  />
                ))
              ) : (
                <Line
                  points={flattenScreenPoints(previewScreen.points)}
                  stroke={previewScreen.color}
                  strokeWidth={2}
                  dash={[8, 5]}
                  closed={previewScreen.type === "AREA"}
                  fill={
                    previewScreen.type === "AREA"
                      ? `${previewScreen.color}33`
                      : undefined
                  }
                  listening={false}
                />
              )
            ) : null}

            {draftLine.length >= 4 && tool !== "curvedPath" ? (
              <Line
                points={draftLine}
                stroke={draftColor}
                strokeWidth={2.5}
                dash={tool === "calibrate" ? [8, 6] : undefined}
                closed={
                  (tool === "area" ||
                    tool === "polygon" ||
                    tool === "deduction") &&
                  draftScreen.length >= 3
                }
                fill={
                  (tool === "area" ||
                    tool === "polygon" ||
                    tool === "deduction") &&
                  draftScreen.length >= 3
                    ? tool === "deduction"
                      ? `${draftColor}55`
                      : `${draftColor}55`
                    : undefined
                }
                listening={false}
              />
            ) : null}
            {curvedDraftFlat && curvedDraftFlat.length >= 4 ? (
              <Line
                points={curvedDraftFlat}
                stroke={draftColor}
                strokeWidth={2}
                lineCap="round"
                lineJoin="round"
                listening={false}
              />
            ) : null}
            {rubberBandPoints ? (
              <Line
                points={rubberBandPoints}
                stroke={draftColor}
                strokeWidth={1.5}
                dash={[6, 4]}
                opacity={closeHintActive ? 1 : 0.85}
                listening={false}
              />
            ) : null}
            {circleDraftScreen ? (
              <Circle
                x={circleDraftScreen.x}
                y={circleDraftScreen.y}
                radius={circleDraftScreen.radius}
                stroke={draftColor}
                strokeWidth={1.5}
                dash={"dash" in circleDraftScreen ? [6, 4] : undefined}
                fill={`${draftColor}22`}
                listening={false}
              />
            ) : null}
            {angleRayPoints ? (
              <Line
                points={angleRayPoints}
                stroke={draftColor}
                strokeWidth={2}
                lineCap="round"
                lineJoin="round"
                listening={false}
              />
            ) : null}
            {draftScreen.map((point, index) => (
              <Circle
                key={`draft-${index}`}
                x={point.x}
                y={point.y}
                radius={
                  index === 0 &&
                  (tool === "area" || tool === "polygon" || tool === "deduction")
                    ? closeHintActive
                      ? 8
                      : 6
                    : 4
                }
                fill={draftColor}
                stroke={
                  index === 0 && closeHintActive ? "#ffffff" : "#0c1b2a"
                }
                strokeWidth={index === 0 && closeHintActive ? 2 : 1}
                listening={false}
              />
            ))}
          </Layer>

          {/* Markup objects (selectable / draggable in select mode) */}
          <Layer>
            {viewer
              ? markupObjects.map((markup) =>
                  renderMarkupNode({
                    markup,
                    viewer,
                    layers,
                    selected:
                      selectedObject?.kind === "markup" &&
                      selectedObject.id === markup.id,
                    selectable: tool === "select",
                    onSelect: () =>
                      onSelectRef.current?.({
                        kind: "markup",
                        id: markup.id,
                      }),
                    onDragEnd: (group) => handleMarkupDragEnd(markup, group),
                  })
                )
              : null}

            {viewer && markupDraft
              ? renderMarkupDraft(markupDraft, viewer, markupStyle)
              : null}
          </Layer>
        </Stage>
      ) : null}
    </div>
  );
}

function renderSessionOverlay(
  overlay: MeasureSessionOverlay,
  viewer: OpenSeadragon.Viewer,
  countMarkerBase: number
): ReactNode {
  const color = overlay.color || "#c2410c";
  const strokeW = 3;
  const screenPts = overlay.points.map((p) =>
    imagePointToScreenPoint(viewer, p)
  );
  const flat = flattenScreenPoints(screenPts);
  const vertexDots = screenPts.map((p, i) => (
    <Circle
      key={`v-${overlay.id}-${i}`}
      x={p.x}
      y={p.y}
      radius={5}
      fill={color}
      stroke="#1c1917"
      strokeWidth={1.5}
      listening={false}
    />
  ));

  if (overlay.kind === "COUNT") {
    return (
      <Group key={overlay.id} listening={false}>
        {screenPts.map((point, index) => (
          <Group key={`${overlay.id}-c-${index}`}>
            <Circle
              x={point.x}
              y={point.y}
              radius={11}
              fill={color}
              stroke="#1c1917"
              strokeWidth={2}
            />
            <Text
              x={point.x - 11}
              y={point.y - 6}
              width={22}
              align="center"
              text={String(countMarkerBase + index + 1)}
              fontSize={11}
              fontStyle="bold"
              fill="#fff7ed"
            />
          </Group>
        ))}
      </Group>
    );
  }

  if (overlay.kind === "CIRCLE") {
    const solved =
      overlay.points.length >= 3
        ? circleFrom3Points(
            overlay.points[0],
            overlay.points[1],
            overlay.points[2]
          )
        : overlay.points.length >= 2
          ? circleFromCenterRadius(overlay.points[0], overlay.points[1])
          : null;
    if (!solved) return null;
    const c = imagePointToScreenPoint(viewer, solved.center);
    const rim = imagePointToScreenPoint(viewer, {
      x: solved.center.x + solved.radiusPx,
      y: solved.center.y,
    });
    // Prefer distance to first circumference point for non-uniform scale.
    const onCirc = imagePointToScreenPoint(viewer, overlay.points[0]);
    const radius = Math.hypot(onCirc.x - c.x, onCirc.y - c.y);
    void rim;
    return (
      <Group key={overlay.id} listening={false}>
        <Circle
          x={c.x}
          y={c.y}
          radius={Math.max(radius, 1)}
          stroke={color}
          strokeWidth={strokeW}
          fill={`${color}55`}
        />
        {vertexDots}
      </Group>
    );
  }

  if (overlay.kind === "ANGLE" && screenPts.length >= 3) {
    return (
      <Group key={overlay.id} listening={false}>
        <Line
          points={[
            screenPts[1].x,
            screenPts[1].y,
            screenPts[0].x,
            screenPts[0].y,
            screenPts[2].x,
            screenPts[2].y,
          ]}
          stroke={color}
          strokeWidth={strokeW}
          lineCap="round"
          lineJoin="round"
        />
        {vertexDots}
      </Group>
    );
  }

  if (overlay.kind === "CURVED" && overlay.points.length >= 2) {
    const samples: ScreenPoint[] = [];
    const n = 64;
    for (let i = 0; i <= n; i += 1) {
      const p = bezierPointAt(overlay.points, i / n);
      if (p) samples.push(imagePointToScreenPoint(viewer, p));
    }
    return (
      <Group key={overlay.id} listening={false}>
        <Line
          points={flattenScreenPoints(samples)}
          stroke={color}
          strokeWidth={strokeW}
          lineCap="round"
          lineJoin="round"
        />
        {vertexDots}
      </Group>
    );
  }

  if (
    (overlay.kind === "AREA" || overlay.kind === "DEDUCTION") &&
    flat.length >= 6
  ) {
    return (
      <Group key={overlay.id} listening={false}>
        <Line
          points={flat}
          stroke={color}
          strokeWidth={strokeW}
          closed
          dash={overlay.kind === "DEDUCTION" ? [8, 5] : undefined}
          fill={
            overlay.kind === "DEDUCTION" ? `${color}33` : `${color}55`
          }
        />
        {vertexDots}
      </Group>
    );
  }

  if (flat.length >= 4) {
    return (
      <Group key={overlay.id} listening={false}>
        <Line
          points={flat}
          stroke={color}
          strokeWidth={strokeW}
          lineCap="round"
          lineJoin="round"
        />
        {vertexDots}
      </Group>
    );
  }

  return null;
}

function renderMarkupDraft(
  draft: MarkupDraft,
  viewer: OpenSeadragon.Viewer,
  style: MarkupStyle
): ReactNode {
  if (draft.type === "FREEHAND") {
    const points = flattenScreenPoints(
      draft.points.map((point) => imagePointToScreenPoint(viewer, point))
    );
    return (
      <Line
        points={points}
        stroke={style.color}
        strokeWidth={style.strokeWidth}
        lineCap="round"
        lineJoin="round"
        tension={0.2}
      />
    );
  }

  if (draft.type === "LINE") {
    const a = imagePointToScreenPoint(viewer, draft.start);
    const b = imagePointToScreenPoint(viewer, draft.end);
    return (
      <Line
        points={[a.x, a.y, b.x, b.y]}
        stroke={style.color}
        strokeWidth={style.strokeWidth}
      />
    );
  }

  if (draft.type === "RECTANGLE") {
    const rect = normalizeRectangle(
      draft.start.x,
      draft.start.y,
      draft.end.x,
      draft.end.y
    );
    const topLeft = imagePointToScreenPoint(viewer, { x: rect.x, y: rect.y });
    const bottomRight = imagePointToScreenPoint(viewer, {
      x: rect.x + rect.width,
      y: rect.y + rect.height,
    });
    return (
      <Rect
        x={topLeft.x}
        y={topLeft.y}
        width={bottomRight.x - topLeft.x}
        height={bottomRight.y - topLeft.y}
        stroke={style.color}
        strokeWidth={style.strokeWidth}
      />
    );
  }

  const ellipse = ellipseFromCorners(
    draft.start.x,
    draft.start.y,
    draft.end.x,
    draft.end.y
  );
  const center = imagePointToScreenPoint(viewer, {
    x: ellipse.cx,
    y: ellipse.cy,
  });
  const edge = imagePointToScreenPoint(viewer, {
    x: ellipse.cx + ellipse.radiusX,
    y: ellipse.cy + ellipse.radiusY,
  });
  return (
    <Ellipse
      x={center.x}
      y={center.y}
      radiusX={Math.abs(edge.x - center.x)}
      radiusY={Math.abs(edge.y - center.y)}
      stroke={style.color}
      strokeWidth={style.strokeWidth}
    />
  );
}

function renderMarkupNode(options: {
  markup: MarkupObject;
  viewer: OpenSeadragon.Viewer;
  layers: LayerType[];
  selected: boolean;
  selectable: boolean;
  onSelect: () => void;
  onDragEnd: (group: Konva.Group) => void;
}): ReactNode {
  const { markup, viewer, layers, selected, selectable, onSelect, onDragEnd } =
    options;
  const stroke = getColorForItem(markup, layers).color;
  const strokeWidth = selected ? markup.strokeWidth + 1 : markup.strokeWidth;
  const selectedProps = selected ? { dash: [8, 5] as number[] } : {};

  return (
    <Group
      key={markup.id}
      draggable={selectable}
      onClick={(event) => {
        event.cancelBubble = true;
        if (selectable) {
          onSelect();
        }
      }}
      onTap={(event) => {
        event.cancelBubble = true;
        if (selectable) {
          onSelect();
        }
      }}
      onDragEnd={(event) => onDragEnd(event.target as Konva.Group)}
    >
      {markup.type === "FREEHAND"
        ? (() => {
            const data = markup.data as unknown as FreehandData;
            const points = flattenScreenPoints(
              (data.points ?? []).map((point) =>
                imagePointToScreenPoint(viewer, point)
              )
            );
            return (
              <Line
                points={points}
                stroke={stroke}
                strokeWidth={strokeWidth}
                lineCap="round"
                lineJoin="round"
                tension={0.2}
                {...selectedProps}
              />
            );
          })()
        : null}

      {markup.type === "POLYGON"
        ? (() => {
            const data = markup.data as unknown as PolygonData;
            const points = flattenScreenPoints(
              (data.points ?? []).map((point) =>
                imagePointToScreenPoint(viewer, point)
              )
            );
            return (
              <Line
                points={points}
                stroke={stroke}
                strokeWidth={strokeWidth}
                closed
                fill={`${stroke}22`}
                lineJoin="round"
                {...selectedProps}
              />
            );
          })()
        : null}

      {markup.type === "LINE"
        ? (() => {
            const data = markup.data as unknown as LineData;
            const a = imagePointToScreenPoint(viewer, {
              x: data.x1,
              y: data.y1,
            });
            const b = imagePointToScreenPoint(viewer, {
              x: data.x2,
              y: data.y2,
            });
            return (
              <Line
                points={[a.x, a.y, b.x, b.y]}
                stroke={stroke}
                strokeWidth={strokeWidth}
                {...selectedProps}
              />
            );
          })()
        : null}

      {markup.type === "RECTANGLE"
        ? (() => {
            const data = markup.data as unknown as RectangleData;
            const topLeft = imagePointToScreenPoint(viewer, {
              x: data.x,
              y: data.y,
            });
            const bottomRight = imagePointToScreenPoint(viewer, {
              x: data.x + data.width,
              y: data.y + data.height,
            });
            return (
              <Rect
                x={topLeft.x}
                y={topLeft.y}
                width={bottomRight.x - topLeft.x}
                height={bottomRight.y - topLeft.y}
                stroke={stroke}
                strokeWidth={strokeWidth}
                {...selectedProps}
              />
            );
          })()
        : null}

      {markup.type === "ELLIPSE"
        ? (() => {
            const data = markup.data as unknown as EllipseData;
            const center = imagePointToScreenPoint(viewer, {
              x: data.cx,
              y: data.cy,
            });
            const edge = imagePointToScreenPoint(viewer, {
              x: data.cx + data.radiusX,
              y: data.cy + data.radiusY,
            });
            return (
              <Ellipse
                x={center.x}
                y={center.y}
                radiusX={Math.abs(edge.x - center.x)}
                radiusY={Math.abs(edge.y - center.y)}
                stroke={stroke}
                strokeWidth={strokeWidth}
                {...selectedProps}
              />
            );
          })()
        : null}

      {markup.type === "TEXT"
        ? (() => {
            const data = markup.data as unknown as TextData;
            const anchor = imagePointToScreenPoint(viewer, {
              x: data.x,
              y: data.y,
            });
            return (
              <Text
                x={anchor.x}
                y={anchor.y}
                text={markup.textContent ?? ""}
                fontSize={Math.max(12, strokeWidth * 6)}
                fill={stroke}
                fontStyle="bold"
                {...selectedProps}
              />
            );
          })()
        : null}
    </Group>
  );
}
