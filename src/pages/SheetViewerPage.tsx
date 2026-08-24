import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchSheets, saveSheetCalibration } from '../api/sheets'
import {
  createTakeoffItem,
  deleteTakeoffItem,
  fetchTakeoffItems,
  updateTakeoffItem,
} from '../api/takeoffItems'
import {
  createMarkup,
  deleteMarkup,
  fetchMarkups,
  updateMarkup,
} from '../api/markupObjects'
import { createLayer, fetchLayers, updateLayer } from '../api/layers'
import { downloadSheetMarkedPdf } from '../api/exportPdf'
import {
  acceptAiSuggestion,
  fetchAiSuggestions,
  rejectAiSuggestion,
  restoreAiSuggestion,
  type AcceptAiSuggestionEdits,
} from '../api/aiSuggestions'
import {
  promoteBlueprintSource,
  type PromotionMeasurementType,
  type PromotionSourceKind,
} from '../api/blueprintPromotions'
import { getProject } from '../api/projectsApi'
import { SheetViewer } from '../components/SheetViewer'
import { TakeoffSidebar } from '../components/TakeoffSidebar'
import { LayersPanel } from '../components/LayersPanel'
import { SheetLegend } from '../components/SheetLegend'
import { ExtractedRoomsPanel } from '../components/ExtractedRoomsPanel'
import PromoteToElementDialog from '../components/PromoteToElementDialog'
import { NumericInput } from '../components/ui'
import { aiSuggestionsForPins } from '../lib/aiSuggestionPinCoords'
import { computeCalibrationScale } from '../lib/osdCoordinates'
import type { ImagePoint } from '../lib/measurementMath'
import type { MarkupGeometry } from '../lib/markupGeometry'
import { previewTakeoffMeasurement } from '../lib/measurementPreview'
import { nextSequentialLabel } from '../lib/takeoffLabels'
import { applyRedo, applyUndo } from '../lib/historyActions'
import {
  selectCanRedo,
  selectCanUndo,
  useHistoryStore,
} from '../store/historyStore'
import { getColorForItem } from '../lib/itemLayerColor'
import { isObjectOnVisibleLayer } from '../lib/layerVisibility'
import { buildSheetLegendEntries } from '../lib/legendEntries'
import type {
  CalibrationUnitLabel,
  AiSuggestion,
  Layer,
  MarkupObject,
  SelectedObject,
  TakeoffItem,
  TakeoffType,
  ViewerTool,
} from '../types/models'

interface PendingAcceptPlacement {
  id: string
  label: string
  edits: AcceptAiSuggestionEdits
}

interface PendingMeasurement {
  type: TakeoffType
  points: ImagePoint[]
  color: string
  defaultLabel: string
  label: string
  anchorScreen?: { x: number; y: number }
}

interface PendingText {
  point: ImagePoint
  value: string
}

interface PendingPromotion {
  sourceKind: PromotionSourceKind
  sourceId: string
  measurementType: PromotionMeasurementType
  sourceLabel: string
  value: number
  unit: string
}

const MEASURE_TOOLS: Array<{ id: ViewerTool; label: string }> = [
  { id: 'pan', label: 'Pan' },
  { id: 'select', label: 'Select' },
  { id: 'linear', label: 'Linear' },
  { id: 'area', label: 'Area' },
  { id: 'count', label: 'Count' },
]

const MARKUP_TOOLS: Array<{ id: ViewerTool; label: string }> = [
  { id: 'freehand', label: 'Pen' },
  { id: 'markupLine', label: 'Line' },
  { id: 'rectangle', label: 'Rect' },
  { id: 'ellipse', label: 'Ellipse' },
  { id: 'polygon', label: 'Polygon' },
  { id: 'text', label: 'Text' },
]

function formatCalibrationStatus(
  scale: number | null | undefined,
  unit: string | null | undefined,
): string {
  if (scale == null || unit == null) {
    return 'Not calibrated'
  }
  return `Calibrated: 1px = ${scale.toPrecision(4)} ${unit}`
}

function formatPreviewValue(value: number): string {
  if (Number.isInteger(value)) return String(value)
  return value.toPrecision(6).replace(/\.?0+$/, '')
}

export default function SheetViewerPage() {
  const { projectId = '', sheetId = '' } = useParams<{
    projectId: string
    sheetId: string
  }>()
  const queryClient = useQueryClient()
  const [tool, setTool] = useState<ViewerTool>('pan')
  const [pending, setPending] = useState<{ pixelDistance: number } | null>(null)
  const [distanceInput, setDistanceInput] = useState<number | null>(null)
  const [unit, setUnit] = useState<CalibrationUnitLabel>('ft')
  const [formError, setFormError] = useState<string | null>(null)
  const [measureError, setMeasureError] = useState<string | null>(null)
  const [historyBusy, setHistoryBusy] = useState(false)
  const [selectedObject, setSelectedObject] = useState<SelectedObject | null>(
    null,
  )
  const [pendingMeasurement, setPendingMeasurement] =
    useState<PendingMeasurement | null>(null)
  const [countLabel, setCountLabel] = useState('Door')
  const [countLabelReady, setCountLabelReady] = useState(false)
  const [localTakeoffs, setLocalTakeoffs] = useState<TakeoffItem[] | null>(null)
  const [localMarkups, setLocalMarkups] = useState<MarkupObject[] | null>(null)
  const [pendingText, setPendingText] = useState<PendingText | null>(null)
  const [strokeWidth, setStrokeWidth] = useState(2)
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null)
  const [uncategorizedVisible, setUncategorizedVisible] = useState(true)
  const [layersCollapsed, setLayersCollapsed] = useState(false)
  const [createLayerFormOpen, setCreateLayerFormOpen] = useState(false)
  const [layerCreateError, setLayerCreateError] = useState<string | null>(null)
  const [exportBusy, setExportBusy] = useState(false)
  const [suggestionBusyId, setSuggestionBusyId] = useState<string | null>(null)
  const [suggestionError, setSuggestionError] = useState<string | null>(null)
  const [tracingTakeoffId, setTracingTakeoffId] = useState<string | null>(null)
  const [roomsPanelOpen, setRoomsPanelOpen] = useState(false)
  const [roomsPanelUserToggled, setRoomsPanelUserToggled] = useState(false)
  const [highlightedTakeoffId, setHighlightedTakeoffId] = useState<
    string | null
  >(null)
  const [showAiPins, setShowAiPins] = useState(true)
  const [selectedAiPinId, setSelectedAiPinId] = useState<string | null>(null)
  const [placingAccept, setPlacingAccept] =
    useState<PendingAcceptPlacement | null>(null)
  const [pendingPromotion, setPendingPromotion] =
    useState<PendingPromotion | null>(null)
  const [promotionBusy, setPromotionBusy] = useState(false)
  const [promotionError, setPromotionError] = useState<string | null>(null)

  const measureConfirmingRef = useRef(false)
  const activeLayerIdRef = useRef<string | null>(null)
  activeLayerIdRef.current = activeLayerId
  const debounceTimerRef = useRef<number | null>(null)
  const pendingPatchRef = useRef<{
    id: string
    data: MarkupGeometry
    textContent?: string | null
    before: MarkupObject
    after: MarkupObject
  } | null>(null)
  const history = useHistoryStore()
  const canUndo = useHistoryStore(selectCanUndo)
  const canRedo = useHistoryStore(selectCanRedo)

  const sheetsQuery = useQuery({
    queryKey: ['projects', projectId, 'sheets'],
    queryFn: () => fetchSheets(projectId),
    enabled: Boolean(projectId),
    refetchInterval: (query) => {
      const current = (query.state.data ?? []).find((row) => row.id === sheetId)
      const status = current?.aiExtractionStatus
      if (status === 'pending' || status === 'processing') {
        return 3000
      }
      return false
    },
  })

  const projectQuery = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => getProject(projectId),
    enabled: Boolean(projectId),
  })

  const takeoffQuery = useQuery({
    queryKey: ['sheets', sheetId, 'takeoff-items'],
    queryFn: () => fetchTakeoffItems(sheetId),
    enabled: Boolean(sheetId),
  })

  const markupsQuery = useQuery({
    queryKey: ['sheets', sheetId, 'markups'],
    queryFn: () => fetchMarkups(sheetId),
    enabled: Boolean(sheetId),
  })

  const layersQuery = useQuery({
    queryKey: ['projects', projectId, 'layers'],
    queryFn: () => fetchLayers(projectId),
    enabled: Boolean(projectId),
  })

  const aiSuggestionsQuery = useQuery({
    queryKey: ['sheets', sheetId, 'ai-suggestions'],
    queryFn: () => fetchAiSuggestions(sheetId),
    enabled: Boolean(sheetId),
    refetchInterval: () => {
      const status = sheetsQuery.data?.find((row) => row.id === sheetId)
        ?.aiExtractionStatus
      if (status === 'pending' || status === 'processing') {
        return 3000
      }
      return false
    },
  })

  useEffect(() => {
    history.clear()
    setTool('pan')
    setPending(null)
    setDistanceInput(null)
    setFormError(null)
    setMeasureError(null)
    setSelectedObject(null)
    setLocalTakeoffs(null)
    setLocalMarkups(null)
    setPendingMeasurement(null)
    setPendingText(null)
    measureConfirmingRef.current = false
    setCountLabel('Door')
    setCountLabelReady(false)
    setStrokeWidth(2)
    setActiveLayerId(null)
    setUncategorizedVisible(true)
    setCreateLayerFormOpen(false)
    setLayerCreateError(null)
    setSuggestionError(null)
    setTracingTakeoffId(null)
    setRoomsPanelOpen(false)
    setRoomsPanelUserToggled(false)
    setHighlightedTakeoffId(null)
    setPlacingAccept(null)
    setSelectedAiPinId(null)
    // Reset only when the open sheet changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetId])

  useEffect(() => {
    if (takeoffQuery.data) {
      setLocalTakeoffs(takeoffQuery.data)
    }
  }, [takeoffQuery.data])

  useEffect(() => {
    if (markupsQuery.data) {
      setLocalMarkups(markupsQuery.data)
    }
  }, [markupsQuery.data])

  const sheets = sheetsQuery.data ?? []
  const sheet = sheets.find((row) => row.id === sheetId) ?? null
  const sheetIndex = sheets.findIndex((row) => row.id === sheetId)
  const prevSheet = sheetIndex > 0 ? sheets[sheetIndex - 1] : null
  const nextSheet =
    sheetIndex >= 0 && sheetIndex < sheets.length - 1
      ? sheets[sheetIndex + 1]
      : null

  const isCalibrated =
    sheet?.calibrationScale != null &&
    sheet.calibrationScale > 0 &&
    Boolean(sheet.calibrationUnit)

  const takeoffs = localTakeoffs ?? takeoffQuery.data ?? []
  const markups = localMarkups ?? markupsQuery.data ?? []
  const layers = layersQuery.data ?? []

  const legendEntries = useMemo(
    () =>
      buildSheetLegendEntries({
        layers,
        takeoffs,
        markups,
        uncategorizedVisible,
      }),
    [layers, takeoffs, markups, uncategorizedVisible],
  )

  const visibleTakeoffs = useMemo(
    () =>
      takeoffs.filter(
        (item) =>
          item.points != null &&
          item.points.length > 0 &&
          isObjectOnVisibleLayer(item.layerId, layers, uncategorizedVisible),
      ),
    [takeoffs, layers, uncategorizedVisible],
  )

  const visibleMarkups = useMemo(
    () =>
      markups.filter((item) =>
        isObjectOnVisibleLayer(item.layerId, layers, uncategorizedVisible),
      ),
    [markups, layers, uncategorizedVisible],
  )

  const activeDrawColor = useMemo(
    () => getColorForItem({ layerId: activeLayerId }, layers).color,
    [activeLayerId, layers],
  )

  useEffect(() => {
    if (layers.length === 0) {
      return
    }
    setActiveLayerId((prev) => {
      if (prev != null && layers.some((layer) => layer.id === prev)) {
        return prev
      }
      return layers[0]?.id ?? null
    })
  }, [layers, sheetId])

  function requireActiveLayerForDraw(): boolean {
    if (layers.length === 0) {
      setMeasureError('Create a layer before drawing on the plan.')
      return false
    }
    if (activeLayerIdRef.current == null) {
      setMeasureError(
        'Select a layer in the Layers panel (not Uncategorized) before drawing.',
      )
      return false
    }
    return true
  }

  const allAiSuggestions = aiSuggestionsQuery.data ?? []
  const pendingAiCount = allAiSuggestions.filter(
    (row) => row.status === 'PENDING',
  ).length

  const aiRoomPins = useMemo(
    () =>
      aiSuggestionsForPins(allAiSuggestions).map(
        ({ imagePoint, ...suggestion }) => ({
          suggestion,
          imagePoint,
        }),
      ),
    [allAiSuggestions],
  )

  useEffect(() => {
    if (!placingAccept) {
      return
    }
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'Escape') {
        return
      }
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return
      }
      event.preventDefault()
      setPlacingAccept(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [placingAccept])

  useEffect(() => {
    if (roomsPanelUserToggled) {
      return
    }
    setRoomsPanelOpen(pendingAiCount > 0)
  }, [pendingAiCount, roomsPanelUserToggled, sheetId])

  function handleRequestAccept(
    suggestionId: string,
    edits: AcceptAiSuggestionEdits,
  ): void {
    setSuggestionError(null)
    const row = allAiSuggestions.find((s) => s.id === suggestionId)
    setPlacingAccept({
      id: suggestionId,
      label: edits.label?.trim() || row?.label || 'Room',
      edits,
    })
    setSelectedAiPinId(null)
  }

  async function handleConfirmAcceptPlacement(point: ImagePoint): Promise<void> {
    if (!placingAccept) {
      return
    }
    setSuggestionError(null)
    setSuggestionBusyId(placingAccept.id)
    try {
      const result = await acceptAiSuggestion(placingAccept.id, {
        ...placingAccept.edits,
        confirmedX: point.x,
        confirmedY: point.y,
      })
      setLocalTakeoffs((prev) => [...(prev ?? takeoffs), result.item])
      setPlacingAccept(null)
      await queryClient.invalidateQueries({
        queryKey: ['sheets', sheetId, 'ai-suggestions'],
      })
      await queryClient.invalidateQueries({
        queryKey: ['sheets', sheetId, 'takeoff-items'],
      })
    } catch (error: unknown) {
      setSuggestionError(
        error instanceof Error ? error.message : 'Failed to accept suggestion',
      )
    } finally {
      setSuggestionBusyId(null)
    }
  }

  async function handleRejectSuggestion(suggestionId: string): Promise<void> {
    setSuggestionError(null)
    setSuggestionBusyId(suggestionId)
    try {
      await rejectAiSuggestion(suggestionId)
      await queryClient.invalidateQueries({
        queryKey: ['sheets', sheetId, 'ai-suggestions'],
      })
    } catch (error: unknown) {
      setSuggestionError(
        error instanceof Error ? error.message : 'Failed to reject suggestion',
      )
    } finally {
      setSuggestionBusyId(null)
    }
  }

  async function handleRestoreSuggestion(suggestionId: string): Promise<void> {
    setSuggestionError(null)
    setSuggestionBusyId(suggestionId)
    try {
      await restoreAiSuggestion(suggestionId)
      await queryClient.invalidateQueries({
        queryKey: ['sheets', sheetId, 'ai-suggestions'],
      })
    } catch (error: unknown) {
      setSuggestionError(
        error instanceof Error ? error.message : 'Failed to restore suggestion',
      )
    } finally {
      setSuggestionBusyId(null)
    }
  }

  function requestTakeoffPromotion(item: TakeoffItem): void {
    if (
      item.source !== 'MANUAL' ||
      (item.type !== 'AREA' && item.type !== 'LINEAR') ||
      item.promotedInstanceId
    ) {
      return
    }
    setPromotionError(null)
    setPendingPromotion({
      sourceKind: 'TAKEOFF_ITEM',
      sourceId: item.id,
      measurementType: item.type,
      sourceLabel: item.label || (item.type === 'AREA' ? 'Area' : 'Linear'),
      value: item.calculatedValue,
      unit: item.unit,
    })
  }

  function requestAiPromotion(suggestion: AiSuggestion): void {
    if (suggestion.status !== 'ACCEPTED' || suggestion.promotedInstanceId) return
    const item = takeoffs.find((row) => row.id === suggestion.takeoffItemId)
    if (!item) {
      setSuggestionError('The accepted room has no linked measurement.')
      return
    }
    setPromotionError(null)
    setPendingPromotion({
      sourceKind: 'AI_SUGGESTION',
      sourceId: suggestion.id,
      measurementType: 'AREA',
      sourceLabel: suggestion.label,
      value: item.calculatedValue,
      unit: item.unit,
    })
  }

  async function confirmPromotion(input: {
    floorId: string
    elementKey: string
  }): Promise<void> {
    if (!pendingPromotion) return
    setPromotionBusy(true)
    setPromotionError(null)
    try {
      const result = await promoteBlueprintSource(projectId, {
        sourceKind: pendingPromotion.sourceKind,
        sourceId: pendingPromotion.sourceId,
        floorId: input.floorId,
        elementKey: input.elementKey,
      })
      const promotedTakeoffId =
        pendingPromotion.sourceKind === 'TAKEOFF_ITEM'
          ? pendingPromotion.sourceId
          : allAiSuggestions.find(
              (row) => row.id === pendingPromotion.sourceId,
            )?.takeoffItemId
      if (promotedTakeoffId) {
        setLocalTakeoffs((prev) =>
          (prev ?? takeoffs).map((row) =>
            row.id === promotedTakeoffId
              ? { ...row, promotedInstanceId: result.instance.id }
              : row,
          ),
        )
      }
      setPendingPromotion(null)
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['sheets', sheetId, 'takeoff-items'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['sheets', sheetId, 'ai-suggestions'],
        }),
        queryClient.invalidateQueries({ queryKey: ['instances', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['reports', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['cost-plan', projectId] }),
      ])
    } catch (error: unknown) {
      setPromotionError(
        error instanceof Error ? error.message : 'Failed to promote measurement',
      )
    } finally {
      setPromotionBusy(false)
    }
  }

  function focusTakeoffItem(takeoffItemId: string): void {
    setHighlightedTakeoffId(takeoffItemId)
    setSelectedObject({ kind: 'takeoff', id: takeoffItemId })
    window.setTimeout(() => setHighlightedTakeoffId(null), 4000)
  }

  function toggleRoomsPanel(): void {
    setRoomsPanelUserToggled(true)
    setRoomsPanelOpen((open) => !open)
  }

  function startTraceShape(itemId: string): void {
    setTracingTakeoffId(itemId)
    setMeasureError(null)
    setSuggestionError(null)
    setTool('area')
  }

  const isLoading = sheetsQuery.isLoading
  const loadError =
    sheetsQuery.error?.message ??
    (!isLoading && !sheet ? 'Sheet not found' : null)

  const historyHandlers = useMemo(
    () => ({
      onTakeoffCreated: (item: TakeoffItem) => {
        setLocalTakeoffs((prev) => [...(prev ?? []), item])
      },
      onTakeoffDeleted: (id: string) => {
        setLocalTakeoffs((prev) => (prev ?? []).filter((item) => item.id !== id))
        setSelectedObject((sel) =>
          sel?.kind === 'takeoff' && sel.id === id ? null : sel,
        )
      },
      onMarkupCreated: (markup: MarkupObject) => {
        setLocalMarkups((prev) => [...(prev ?? []), markup])
      },
      onMarkupDeleted: (id: string) => {
        setLocalMarkups((prev) => (prev ?? []).filter((item) => item.id !== id))
        setSelectedObject((sel) =>
          sel?.kind === 'markup' && sel.id === id ? null : sel,
        )
      },
      onMarkupUpdated: (markup: MarkupObject) => {
        setLocalMarkups((prev) =>
          (prev ?? []).map((item) => (item.id === markup.id ? markup : item)),
        )
      },
    }),
    [],
  )

  async function refreshLists(): Promise<void> {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['sheets', sheetId, 'takeoff-items'],
      }),
      queryClient.invalidateQueries({
        queryKey: ['sheets', sheetId, 'markups'],
      }),
    ])
  }

  const saveCalibrationMutation = useMutation({
    mutationFn: (payload: { scale: number; unit: CalibrationUnitLabel }) =>
      saveSheetCalibration(sheetId, payload.scale, payload.unit),
    onSuccess: async (updated) => {
      queryClient.setQueryData(
        ['projects', projectId, 'sheets'],
        sheets.map((row) => (row.id === updated.id ? updated : row)),
      )
      setPending(null)
      setDistanceInput(null)
      setTool('pan')
    },
  })

  const createItemMutation = useMutation({
    mutationFn: (payload: {
      type: TakeoffType
      points: ImagePoint[]
      color: string
      label?: string
      layerId?: string | null
    }) => createTakeoffItem(sheetId, payload),
    onSuccess: async (item) => {
      setMeasureError(null)
      setPendingMeasurement(null)
      measureConfirmingRef.current = false
      setLocalTakeoffs((prev) => [...(prev ?? takeoffQuery.data ?? []), item])
      history.push({ type: 'takeoff_create', item })
      await refreshLists()
    },
    onError: (error: Error) => {
      measureConfirmingRef.current = false
      setMeasureError(error.message)
    },
  })

  const renameItemMutation = useMutation({
    mutationFn: (payload: { itemId: string; label: string | null }) =>
      updateTakeoffItem(sheetId, payload.itemId, { label: payload.label }),
    onSuccess: async (item) => {
      setLocalTakeoffs((prev) =>
        (prev ?? takeoffQuery.data ?? []).map((row) =>
          row.id === item.id ? item : row,
        ),
      )
      await refreshLists()
    },
    onError: (error: Error) => {
      setMeasureError(error.message)
    },
  })

  const deleteItemMutation = useMutation({
    mutationFn: async (item: TakeoffItem) => {
      await deleteTakeoffItem(sheetId, item.id)
      return item
    },
    onSuccess: async (item) => {
      setLocalTakeoffs((prev) =>
        (prev ?? takeoffQuery.data ?? []).filter((row) => row.id !== item.id),
      )
      history.push({ type: 'takeoff_delete', item })
      setSelectedObject(null)
      await refreshLists()
    },
  })

  const createLayerMutation = useMutation({
    mutationFn: (input: { name: string; color: string }) =>
      createLayer(projectId, input),
    onSuccess: async (layer) => {
      setCreateLayerFormOpen(false)
      setLayerCreateError(null)
      setActiveLayerId(layer.id)
      setLayersCollapsed(false)
      await queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'layers'],
      })
    },
    onError: (error: Error) => {
      setLayerCreateError(error.message)
    },
  })

  const updateLayerMutation = useMutation({
    mutationFn: (payload: {
      layerId: string
      patch: {
        visible?: boolean
        name?: string
        color?: string
        sortOrder?: number
      }
    }) => updateLayer(projectId, payload.layerId, payload.patch),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'layers'],
      })
    },
  })

  const reassignTakeoffLayerMutation = useMutation({
    mutationFn: (payload: { itemId: string; layerId: string | null }) =>
      updateTakeoffItem(sheetId, payload.itemId, { layerId: payload.layerId }),
    onSuccess: async (item) => {
      setLocalTakeoffs((prev) =>
        (prev ?? takeoffQuery.data ?? []).map((row) =>
          row.id === item.id ? item : row,
        ),
      )
      await refreshLists()
    },
    onError: (error: Error) => {
      setMeasureError(error.message)
    },
  })

  const createMarkupMutation = useMutation({
    mutationFn: (payload: {
      type: MarkupObject['type']
      data: MarkupGeometry
      color: string
      strokeWidth: number
      textContent?: string | null
      layerId?: string | null
    }) => createMarkup(sheetId, payload),
    onSuccess: async (markup) => {
      setLocalMarkups((prev) => [...(prev ?? markupsQuery.data ?? []), markup])
      history.push({ type: 'markup_create', markup })
      setSelectedObject({ kind: 'markup', id: markup.id })
      setTool('select')
      await refreshLists()
    },
    onError: (error: Error) => {
      setMeasureError(error.message)
    },
  })

  const updateMarkupMutation = useMutation({
    mutationFn: (payload: {
      id: string
      data: MarkupGeometry
      textContent?: string | null
      before: MarkupObject
      after: MarkupObject
    }) =>
      updateMarkup(sheetId, payload.id, {
        data: payload.data,
        textContent: payload.textContent,
      }),
    onSuccess: async (_result, variables) => {
      history.push({
        type: 'markup_update',
        before: variables.before,
        after: variables.after,
      })
      await refreshLists()
    },
  })

  const deleteMarkupMutation = useMutation({
    mutationFn: async (markup: MarkupObject) => {
      await deleteMarkup(sheetId, markup.id)
      return markup
    },
    onSuccess: async (markup) => {
      setLocalMarkups((prev) =>
        (prev ?? markupsQuery.data ?? []).filter((item) => item.id !== markup.id),
      )
      history.push({ type: 'markup_delete', markup })
      setSelectedObject(null)
      await refreshLists()
    },
  })

  async function runUndo(): Promise<void> {
    if (historyBusy) return
    const entry = history.popUndo()
    if (!entry) return
    setHistoryBusy(true)
    try {
      const forRedo = await applyUndo(sheetId, entry, historyHandlers)
      history.pushFuture(forRedo)
      await refreshLists()
    } catch (error: unknown) {
      history.pushPastFromRedo(entry)
      setMeasureError(error instanceof Error ? error.message : 'Undo failed')
    } finally {
      setHistoryBusy(false)
    }
  }

  async function runRedo(): Promise<void> {
    if (historyBusy) return
    const entry = history.popRedo()
    if (!entry) return
    setHistoryBusy(true)
    try {
      const forUndo = await applyRedo(sheetId, entry, historyHandlers)
      history.pushPastFromRedo(forUndo)
      await refreshLists()
    } catch (error: unknown) {
      history.pushFuture(entry)
      setMeasureError(error instanceof Error ? error.message : 'Redo failed')
    } finally {
      setHistoryBusy(false)
    }
  }

  function deleteSelected(): void {
    if (!selectedObject) return
    if (selectedObject.kind === 'takeoff') {
      const item = takeoffs.find((row) => row.id === selectedObject.id)
      if (item) deleteItemMutation.mutate(item)
      return
    }
    const markup = markups.find((row) => row.id === selectedObject.id)
    if (markup) deleteMarkupMutation.mutate(markup)
  }

  function cancelPendingMeasurement(): void {
    measureConfirmingRef.current = false
    setPendingMeasurement(null)
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape' && pendingMeasurement) {
        event.preventDefault()
        cancelPendingMeasurement()
        return
      }
      if (event.key === 'Escape' && pendingText) {
        event.preventDefault()
        setPendingText(null)
        return
      }

      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return
      }

      const mod = event.ctrlKey || event.metaKey
      if (mod && event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault()
        void runUndo()
        return
      }
      if (
        mod &&
        (event.key.toLowerCase() === 'y' ||
          (event.key.toLowerCase() === 'z' && event.shiftKey))
      ) {
        event.preventDefault()
        void runRedo()
        return
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedObject && !pendingMeasurement && !pendingText) {
          event.preventDefault()
          deleteSelected()
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // Tool keyboard shortcuts follow the current selection / history snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedObject,
    takeoffs,
    markups,
    historyBusy,
    canUndo,
    canRedo,
    pendingMeasurement,
    pendingText,
  ])

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current != null) {
        window.clearTimeout(debounceTimerRef.current)
      }
      const pendingPatch = pendingPatchRef.current
      if (pendingPatch) {
        pendingPatchRef.current = null
        void updateMarkup(sheetId, pendingPatch.id, {
          data: pendingPatch.data,
          textContent: pendingPatch.textContent,
        }).then(() => {
          useHistoryStore.getState().push({
            type: 'markup_update',
            before: pendingPatch.before,
            after: pendingPatch.after,
          })
        })
      }
    }
  }, [sheetId])

  function selectTool(next: ViewerTool): void {
    setMeasureError(null)
    setFormError(null)
    setPending(null)
    setDistanceInput(null)
    setPendingMeasurement(null)
    setPendingText(null)
    measureConfirmingRef.current = false
    if (next !== 'area') {
      setTracingTakeoffId(null)
    }

    // Trace Shape attaches geometry only — calibration not required.
    if (
      (next === 'linear' || next === 'area') &&
      !isCalibrated &&
      !(next === 'area' && tracingTakeoffId)
    ) {
      setMeasureError('Calibrate the sheet before measuring length or area.')
      setTool('pan')
      return
    }

    setTool(next)
  }

  function startCalibration(): void {
    setFormError(null)
    setMeasureError(null)
    setPending(null)
    setDistanceInput(null)
    setPendingMeasurement(null)
    setPendingText(null)
    setTool('calibrate')
  }

  function cancelCalibration(): void {
    setPending(null)
    setDistanceInput(null)
    setFormError(null)
    setTool('pan')
  }

  function handleMeasured(payload: { pixelDistance: number }): void {
    if (!(payload.pixelDistance > 0)) {
      setFormError(
        'Calibration points are too close — try a longer known distance.',
      )
      return
    }
    setPending({ pixelDistance: payload.pixelDistance })
  }

  function handleSaveCalibration(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    if (!pending) return

    const realWorldDistance = distanceInput
    if (realWorldDistance == null || !Number.isFinite(realWorldDistance) || realWorldDistance <= 0) {
      setFormError('Enter a positive real-world distance.')
      return
    }

    try {
      const scale = computeCalibrationScale(
        realWorldDistance,
        pending.pixelDistance,
      )
      setFormError(null)
      saveCalibrationMutation.mutate({ scale, unit })
    } catch (error: unknown) {
      setFormError(
        error instanceof Error ? error.message : 'Failed to compute scale',
      )
    }
  }

  function confirmPendingMeasurement(overrideLabel?: string): void {
    if (!pendingMeasurement || measureConfirmingRef.current) return
    const label =
      (overrideLabel ?? pendingMeasurement.label).trim() ||
      pendingMeasurement.defaultLabel

    measureConfirmingRef.current = true

    if (pendingMeasurement.type === 'COUNT') {
      setCountLabel(label)
      setCountLabelReady(true)
    }

    createItemMutation.mutate({
      type: pendingMeasurement.type,
      points: pendingMeasurement.points,
      color: pendingMeasurement.color,
      label,
      layerId: activeLayerIdRef.current,
    })
  }

  function handleMeasurementComplete(payload: {
    type: TakeoffType
    points: ImagePoint[]
    color: string
    anchorScreen?: { x: number; y: number }
  }): void {
    if (tracingTakeoffId && payload.type === 'AREA') {
      const itemId = tracingTakeoffId
      setTracingTakeoffId(null)
      void updateTakeoffItem(sheetId, itemId, {
        points: payload.points,
      })
        .then((updated) => {
          setLocalTakeoffs((prev) =>
            (prev ?? takeoffs).map((row) =>
              row.id === itemId ? updated : row,
            ),
          )
          void queryClient.invalidateQueries({
            queryKey: ['sheets', sheetId, 'takeoff-items'],
          })
          setTool('select')
        })
        .catch((error: unknown) => {
          setSuggestionError(
            error instanceof Error
              ? error.message
              : 'Failed to attach traced shape',
          )
        })
      return
    }

    if (
      (payload.type === 'LINEAR' || payload.type === 'AREA') &&
      !isCalibrated
    ) {
      setMeasureError('Calibrate the sheet before measuring length or area.')
      return
    }

    if (!requireActiveLayerForDraw()) {
      return
    }

    if (payload.type === 'COUNT' && countLabelReady && countLabel.trim()) {
      createItemMutation.mutate({
        type: 'COUNT',
        points: payload.points,
        color: payload.color,
        label: countLabel.trim(),
        layerId: activeLayerIdRef.current,
      })
      return
    }

    const defaultLabel =
      payload.type === 'AREA'
        ? nextSequentialLabel('Area', takeoffs, 'AREA')
        : payload.type === 'LINEAR'
          ? nextSequentialLabel('Linear', takeoffs, 'LINEAR')
          : countLabel.trim() || 'Door'

    setPendingMeasurement({
      type: payload.type,
      points: payload.points,
      color: payload.color,
      defaultLabel,
      label: defaultLabel,
      anchorScreen: payload.anchorScreen,
    })
  }

  function flushMarkupPatch(): void {
    const pendingPatch = pendingPatchRef.current
    if (!pendingPatch) return
    pendingPatchRef.current = null
    updateMarkupMutation.mutate(pendingPatch)
  }

  function handleMarkupUpdate(
    id: string,
    patch: { data: MarkupGeometry; textContent?: string | null },
    previous: MarkupObject,
  ): void {
    const after: MarkupObject = {
      ...previous,
      data: patch.data as unknown as MarkupObject['data'],
      textContent:
        patch.textContent !== undefined
          ? patch.textContent
          : previous.textContent,
    }

    setLocalMarkups((prev) =>
      (prev ?? markupsQuery.data ?? []).map((item) =>
        item.id === id ? after : item,
      ),
    )

    pendingPatchRef.current = {
      id,
      data: patch.data,
      textContent: patch.textContent,
      before: previous,
      after,
    }
    if (debounceTimerRef.current != null) {
      window.clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = window.setTimeout(() => {
      flushMarkupPatch()
    }, 350)
  }

  function handleTextSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    if (!pendingText || !pendingText.value.trim()) {
      setPendingText(null)
      return
    }
    if (!requireActiveLayerForDraw()) {
      return
    }
    createMarkupMutation.mutate({
      type: 'TEXT',
      data: { x: pendingText.point.x, y: pendingText.point.y },
      color: activeDrawColor,
      strokeWidth,
      textContent: pendingText.value.trim(),
      layerId: activeLayerIdRef.current,
    })
    setPendingText(null)
  }

  const activeTool: ViewerTool = tool === 'calibrate' && pending ? 'pan' : tool
  const title = sheet?.pageTitle?.trim() || sheet?.name || 'Sheet'
  const isMarkupTool =
    tool === 'select' ||
    tool === 'freehand' ||
    tool === 'markupLine' ||
    tool === 'rectangle' ||
    tool === 'ellipse' ||
    tool === 'polygon' ||
    tool === 'text'
  const isMeasureTool =
    tool === 'linear' || tool === 'area' || tool === 'count'
  const showLayerDrawHint =
    (isMeasureTool || isMarkupTool) &&
    (layers.length === 0 || activeLayerId == null) &&
    !tracingTakeoffId
  const sheetExtracting =
    sheet?.aiExtractionStatus === 'pending' ||
    sheet?.aiExtractionStatus === 'processing'
  const deletingId =
    deleteItemMutation.isPending && deleteItemMutation.variables
      ? deleteItemMutation.variables.id
      : deleteMarkupMutation.isPending && deleteMarkupMutation.variables
        ? deleteMarkupMutation.variables.id
        : null
  const selectedTakeoffId =
    selectedObject?.kind === 'takeoff' ? selectedObject.id : null

  if (!isLoading && sheet && sheetExtracting) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-bg text-ink">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-steel-border bg-panel px-4 py-3 sm:px-5">
          <Link
            to={`/projects/${projectId}/sheets`}
            className="font-display text-xs font-bold tracking-wide text-steel uppercase hover:text-ink"
          >
            ← Drawings
          </Link>
          <span className="ai-extracting-badge border border-steel-border px-3 py-1.5 font-display text-[0.65rem] font-bold tracking-wide uppercase">
            AI Extracting details
          </span>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <div className="relative mb-6 flex h-20 w-20 items-center justify-center">
            <span
              className="absolute inset-0 rounded-full border-2 border-signal/30 border-t-signal"
              style={{ animation: 'spin 0.95s linear infinite' }}
              aria-hidden
            />
            <span className="font-display text-xs font-bold tracking-wide text-signal uppercase">
              AI
            </span>
          </div>
          <h1 className="font-display max-w-md text-2xl font-extrabold tracking-tight">
            AI Extracting details
          </h1>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-steel">
            This sheet is locked while room names, dimensions, and areas are
            read from the plan. You can open it as soon as extraction finishes.
          </p>
          <p className="mt-5 font-display text-sm font-semibold">
            {sheet.pageTitle?.trim() || sheet.name}
          </p>
          <p className="mt-1 text-xs tracking-wide text-steel uppercase">
            Page {sheet.pageNumber}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg text-ink">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-steel-border bg-panel px-4 py-2 sm:px-5">
        <Link
          to={`/projects/${projectId}/sheets`}
          className="font-display text-xs font-bold tracking-wide text-steel uppercase hover:text-ink"
        >
          ← Drawings
        </Link>
        <h1 className="min-w-0 truncate font-display text-sm font-bold">
          {title}
        </h1>
        {sheet ? (
          <span className="text-xs text-steel">
            Page {sheet.pageNumber}
            {sheet.discipline ? ` · ${sheet.discipline}` : ''}
          </span>
        ) : null}

        <span
          className={`px-2.5 py-1 text-xs tracking-wide uppercase ${
            sheet?.calibrationScale != null
              ? 'bg-verified-bg text-verified'
              : 'bg-bg text-steel'
          }`}
        >
          {formatCalibrationStatus(
            sheet?.calibrationScale,
            sheet?.calibrationUnit,
          )}
        </span>

        {tool === 'calibrate' ? (
          <button
            type="button"
            onClick={cancelCalibration}
            className="border border-steel-border px-3 py-2 font-display text-xs font-bold tracking-wide uppercase hover:border-ink"
          >
            Cancel
          </button>
        ) : (
          <button
            type="button"
            onClick={startCalibration}
            disabled={!sheet || Boolean(loadError)}
            className="bg-signal px-3 py-2 font-display text-xs font-bold tracking-wide text-ink uppercase hover:bg-signal-text disabled:cursor-not-allowed disabled:opacity-40"
          >
            Calibrate Scale
          </button>
        )}

        <button
          type="button"
          disabled={!sheet || exportBusy}
          onClick={() => {
            if (!sheet) return
            const visibleLayerIds = layers
              .filter((layer) => layer.visible)
              .map((layer) => layer.id)
            setExportBusy(true)
            setMeasureError(null)
            void downloadSheetMarkedPdf(sheet.id, {
              visibleLayerIds,
              uncategorizedVisible,
            })
              .catch((error: unknown) => {
                setMeasureError(
                  error instanceof Error
                    ? error.message
                    : 'Marked-up PDF export failed',
                )
              })
              .finally(() => setExportBusy(false))
          }}
          className="border border-signal/50 bg-signal/15 px-3 py-2 font-display text-xs font-bold tracking-wide text-signal uppercase hover:bg-signal/25 disabled:opacity-40"
        >
          {exportBusy ? 'Exporting…' : 'Export Marked-up PDF'}
        </button>

        <Link
          to={`/projects/${projectId}/quantity-takeoff?sheetId=${sheetId}`}
          className="border border-steel-border px-3 py-2 font-display text-xs font-bold tracking-wide uppercase hover:border-ink"
        >
          Quantity Takeoff Table
        </Link>

        <button
          type="button"
          onClick={() => {
            setShowAiPins((value) => {
              if (value) {
                setSelectedAiPinId(null)
              }
              return !value
            })
          }}
          className={`border px-3 py-2 font-display text-xs font-bold tracking-wide uppercase ${
            showAiPins
              ? 'border-chalk/50 bg-chalk-bg text-chalk'
              : 'border-steel-border text-steel hover:text-ink'
          }`}
          title="Show or hide AI room pins (only after a human click on Accept)"
        >
          Show AI Pins
        </button>

        <button
          type="button"
          onClick={toggleRoomsPanel}
          className={`border px-3 py-2 font-display text-xs font-bold tracking-wide uppercase ${
            roomsPanelOpen
              ? 'border-chalk/50 bg-chalk-bg text-chalk'
              : 'border-steel-border text-steel hover:text-ink'
          }`}
          title="Review AI extracted rooms for this sheet"
        >
          Extracted Rooms ({pendingAiCount})
        </button>

        <div className="ml-auto flex items-center gap-2">
          {prevSheet ? (
            <Link
              to={`/projects/${projectId}/sheets/${prevSheet.id}`}
              className="border border-steel-border px-2 py-1.5 text-xs uppercase hover:border-ink"
            >
              Prev
            </Link>
          ) : null}
          {nextSheet ? (
            <Link
              to={`/projects/${projectId}/sheets/${nextSheet.id}`}
              className="border border-steel-border px-2 py-1.5 text-xs uppercase hover:border-ink"
            >
              Next
            </Link>
          ) : null}
        </div>
      </header>

      <div className="flex shrink-0 flex-col gap-2 border-b border-steel-border bg-panel px-4 py-2 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 font-display text-[0.65rem] font-bold tracking-wider text-steel uppercase">
            Measure
          </span>
          {MEASURE_TOOLS.map((button) => (
            <button
              key={button.id}
              type="button"
              onClick={() => selectTool(button.id)}
              disabled={tool === 'calibrate'}
              className={`px-3 py-1.5 font-display text-xs font-bold tracking-wide uppercase disabled:opacity-40 ${
                tool === button.id
                  ? 'bg-ink text-bg'
                  : 'border border-steel-border text-steel hover:text-ink'
              }`}
            >
              {button.label}
            </button>
          ))}

          <span className="mx-2 h-4 w-px bg-steel-border" aria-hidden />

          <span className="mr-1 font-display text-[0.65rem] font-bold tracking-wider text-steel uppercase">
            Markup
          </span>
          {MARKUP_TOOLS.map((button) => (
            <button
              key={button.id}
              type="button"
              onClick={() => selectTool(button.id)}
              disabled={tool === 'calibrate'}
              className={`px-3 py-1.5 font-display text-xs font-bold tracking-wide uppercase disabled:opacity-40 ${
                tool === button.id
                  ? 'bg-ink text-bg'
                  : 'border border-steel-border text-steel hover:text-ink'
              }`}
            >
              {button.label}
            </button>
          ))}

          <span className="mx-2 h-4 w-px bg-steel-border" aria-hidden />

          <button
            type="button"
            onClick={() => void runUndo()}
            disabled={!canUndo || historyBusy || tool === 'calibrate'}
            className="border border-steel-border px-3 py-1.5 font-display text-xs font-bold tracking-wide uppercase hover:border-ink disabled:opacity-35"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={() => void runRedo()}
            disabled={!canRedo || historyBusy || tool === 'calibrate'}
            className="border border-steel-border px-3 py-1.5 font-display text-xs font-bold tracking-wide uppercase hover:border-ink disabled:opacity-35"
          >
            Redo
          </button>
          <button
            type="button"
            onClick={deleteSelected}
            disabled={
              !selectedObject ||
              tool === 'calibrate' ||
              deleteItemMutation.isPending ||
              deleteMarkupMutation.isPending
            }
            className="border border-danger/40 px-3 py-1.5 font-display text-xs font-bold tracking-wide text-danger uppercase hover:border-danger disabled:opacity-35"
          >
            Delete
          </button>

          {createItemMutation.isPending ||
          createMarkupMutation.isPending ||
          updateMarkupMutation.isPending ||
          historyBusy ? (
            <span className="ml-auto text-xs text-signal">Saving…</span>
          ) : null}
        </div>

        {isMarkupTool ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-display text-[0.65rem] font-bold tracking-wider text-steel uppercase">
              Markup stroke
            </span>
            <label className="flex items-center gap-2 text-xs text-steel">
              Stroke
              <input
                type="range"
                min={1}
                max={12}
                step={1}
                value={strokeWidth}
                onChange={(event) => setStrokeWidth(Number(event.target.value))}
              />
              <span className="w-4 tabular-nums">{strokeWidth}</span>
            </label>
            {tool === 'select' && selectedObject ? (
              <span className="text-xs text-steel">
                Drag markup to move · Delete to remove
              </span>
            ) : null}
          </div>
        ) : null}

        {tool === 'linear' ? (
          <p className="text-xs text-steel">
            Click vertices · double-click to finish · Esc to cancel
          </p>
        ) : null}
        {tool === 'area' ? (
          <p className="text-xs text-steel">
            Click vertices · double-click or click first point to close · Esc to
            cancel
          </p>
        ) : null}
        {tool === 'count' ? (
          <div className="flex flex-wrap items-center gap-3 text-xs text-steel">
            <span>Click to place markers</span>
            <label className="flex items-center gap-1.5">
              Label
              <input
                value={countLabel}
                onChange={(event) => {
                  setCountLabel(event.target.value)
                  if (event.target.value.trim()) {
                    setCountLabelReady(true)
                  }
                }}
                placeholder="Door"
                className="w-28 border border-steel-border bg-bg px-2 py-1 text-xs text-ink outline-none"
              />
            </label>
          </div>
        ) : null}
        {tool === 'polygon' ? (
          <p className="text-xs text-steel">
            Visual only — click vertices · double-click or click first point to
            close · Esc to cancel
          </p>
        ) : null}
        {tool === 'freehand' ? (
          <p className="text-xs text-steel">Click and drag to draw</p>
        ) : null}
        {tool === 'markupLine' || tool === 'rectangle' || tool === 'ellipse' ? (
          <p className="text-xs text-steel">
            Click and drag · visual only, no measured quantity
          </p>
        ) : null}
        {tool === 'text' ? (
          <p className="text-xs text-steel">Click to place a text note</p>
        ) : null}
        {tool === 'select' && selectedObject ? (
          <p className="text-xs text-steel">
            Click a measurement or markup to select · Delete to remove
          </p>
        ) : null}
        {showLayerDrawHint ? (
          <p className="text-xs text-signal">
            {layers.length === 0
              ? 'Create a layer before drawing on the plan.'
              : 'Select a named layer (not Uncategorized) before drawing.'}
          </p>
        ) : null}
      </div>

      {tool === 'calibrate' ? (
        <div className="shrink-0 border-b border-signal/30 bg-signal/10 px-4 py-2 text-xs text-signal sm:px-5">
          {pending
            ? 'Line placed — enter the real-world distance below.'
            : 'Click two points on a known length (door, grid line, dimension bar).'}
        </div>
      ) : null}

      {measureError ? (
        <div className="shrink-0 border-b border-danger/30 bg-danger-bg px-4 py-2 text-xs text-danger sm:px-5">
          {measureError}
        </div>
      ) : null}

      {suggestionError ? (
        <div className="shrink-0 border-b border-danger/30 bg-danger-bg px-4 py-2 text-xs text-danger sm:px-5">
          {suggestionError}
        </div>
      ) : null}

      {tracingTakeoffId ? (
        <div className="shrink-0 border-b border-chalk/30 bg-chalk-bg px-4 py-2 text-xs text-chalk sm:px-5">
          Trace Shape: click vertices on the plan for this AI room, then
          double-click (or click the first point) to finish. Area stays the AI
          value — the polygon is visual only.{' '}
          <button
            type="button"
            className="font-bold underline underline-offset-2"
            onClick={() => {
              setTracingTakeoffId(null)
              setTool('pan')
            }}
          >
            Cancel
          </button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <div className="relative min-h-0 min-w-0 flex-1 bg-black">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <p className="font-display text-sm tracking-wide text-steel uppercase">
                Loading blueprint…
              </p>
            </div>
          ) : null}

          {loadError ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="text-sm text-danger">{loadError}</p>
              <Link
                to={`/projects/${projectId}/sheets`}
                className="font-display text-sm font-bold text-signal underline underline-offset-4"
              >
                Return to drawings
              </Link>
            </div>
          ) : null}

          {sheet && !loadError ? (
            <>
              {placingAccept ? (
                <div className="pointer-events-none absolute top-3 left-1/2 z-[30] max-w-[min(92%,36rem)] -translate-x-1/2 border border-chalk/50 bg-panel/95 px-4 py-2 text-center text-sm text-ink shadow-lg">
                  Click on the blueprint where this room is:{' '}
                  <span className="font-display font-bold">
                    {placingAccept.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-steel">
                    Press Esc to cancel — location is never guessed by AI
                  </span>
                </div>
              ) : null}
              <SheetViewer
                imageUrl={sheet.originalFileUrl}
                className="h-full w-full"
                layers={layers}
                tool={activeTool}
                takeoffItems={visibleTakeoffs}
                markupObjects={visibleMarkups}
                selectedObject={selectedObject}
                markupStyle={{ color: activeDrawColor, strokeWidth }}
                inputBlocked={Boolean(pendingMeasurement || pendingText)}
                previewMeasurement={
                  pendingMeasurement
                    ? {
                        type: pendingMeasurement.type,
                        points: pendingMeasurement.points,
                        color: pendingMeasurement.color,
                      }
                    : null
                }
                onSelectObject={setSelectedObject}
                onCalibrationMeasured={handleMeasured}
                onMeasurementComplete={handleMeasurementComplete}
                onMarkupCreate={(payload) => {
                  if (!requireActiveLayerForDraw()) {
                    return
                  }
                  createMarkupMutation.mutate({
                    type: payload.type,
                    data: payload.data,
                    color: activeDrawColor,
                    strokeWidth: payload.strokeWidth,
                    textContent: payload.textContent,
                    layerId: activeLayerIdRef.current,
                  })
                }}
                onMarkupUpdate={handleMarkupUpdate}
                onTextPlace={(point) => setPendingText({ point, value: '' })}
                aiRoomPins={aiRoomPins}
                showAiRoomPins={showAiPins}
                selectedAiRoomPinId={selectedAiPinId}
                onSelectAiRoomPin={setSelectedAiPinId}
                clickToLocate={
                  placingAccept
                    ? { roomLabel: placingAccept.label }
                    : null
                }
                onClickToLocate={(point) =>
                  void handleConfirmAcceptPlacement(point)
                }
              />
              <SheetLegend entries={legendEntries} />
            </>
          ) : null}

          {pendingMeasurement ? (
            <>
              <div
                className="absolute inset-0 z-20"
                onMouseDown={() => confirmPendingMeasurement()}
                aria-hidden
              />
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  confirmPendingMeasurement()
                }}
                className="absolute z-30 w-[min(90%,16rem)] border border-steel-border bg-panel p-3 text-ink shadow-lg"
                style={{
                  left: Math.max(
                    12,
                    (pendingMeasurement.anchorScreen?.x ?? 24) + 12,
                  ),
                  top: Math.max(
                    12,
                    (pendingMeasurement.anchorScreen?.y ?? 24) + 12,
                  ),
                }}
              >
                <label className="block text-xs font-medium text-steel">
                  Name
                  <input
                    autoFocus
                    value={pendingMeasurement.label}
                    onChange={(event) =>
                      setPendingMeasurement({
                        ...pendingMeasurement,
                        label: event.target.value,
                      })
                    }
                    onBlur={() => confirmPendingMeasurement()}
                    className="mt-1 w-full border border-steel-border bg-bg px-2 py-1.5 text-sm outline-none"
                    placeholder={pendingMeasurement.defaultLabel}
                  />
                </label>
                {(() => {
                  const preview = previewTakeoffMeasurement(
                    pendingMeasurement.type,
                    pendingMeasurement.points,
                    sheet?.calibrationScale,
                    sheet?.calibrationUnit,
                  )
                  if (!preview) return null
                  return (
                    <p className="mt-1.5 text-[0.7rem] text-steel tabular-nums">
                      {formatPreviewValue(preview.value)} {preview.unit}
                    </p>
                  )
                })()}
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={cancelPendingMeasurement}
                    className="px-2 py-1 text-xs text-steel hover:text-ink"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    onMouseDown={(event) => event.preventDefault()}
                    disabled={createItemMutation.isPending}
                    className="bg-signal px-3 py-1 font-display text-xs font-bold text-ink uppercase disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
              </form>
            </>
          ) : null}

          {pendingText ? (
            <form
              onSubmit={handleTextSubmit}
              className="absolute top-4 left-1/2 z-30 w-[min(90%,20rem)] -translate-x-1/2 border border-steel-border bg-panel p-3 text-ink shadow-lg"
            >
              <label className="block text-xs font-medium text-steel">
                Text
                <input
                  autoFocus
                  value={pendingText.value}
                  onChange={(event) =>
                    setPendingText({
                      ...pendingText,
                      value: event.target.value,
                    })
                  }
                  className="mt-1 w-full border border-steel-border bg-bg px-2 py-1.5 text-sm outline-none"
                  placeholder="Enter note…"
                />
              </label>
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPendingText(null)}
                  className="px-2 py-1 text-xs text-steel hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-signal px-3 py-1 font-display text-xs font-bold text-ink uppercase"
                >
                  Place
                </button>
              </div>
            </form>
          ) : null}

          {pending ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-bg/70 p-4">
              <form
                onSubmit={handleSaveCalibration}
                className="w-full max-w-sm border border-steel-border bg-panel p-5 text-ink shadow-lg"
              >
                <h2 className="font-display text-lg font-bold tracking-tight">
                  What is this distance in real life?
                </h2>
                <p className="mt-1 text-xs text-steel">
                  Measured {pending.pixelDistance.toFixed(2)} px on the image.
                </p>

                <div className="mt-4 flex gap-2">
                  <div className="min-w-0 flex-1">
                    <NumericInput
                      min={0.000001}
                      value={distanceInput}
                      allowEmpty
                      onChange={setDistanceInput}
                      placeholder="e.g. 10"
                      className="w-full border border-steel-border bg-bg px-3 py-2 text-sm outline-none"
                      required
                      autoFocus
                    />
                  </div>
                  <select
                    value={unit}
                    onChange={(event) =>
                      setUnit(event.target.value as CalibrationUnitLabel)
                    }
                    className="border border-steel-border bg-bg px-2 py-2 text-sm outline-none"
                  >
                    <option value="ft">ft</option>
                    <option value="m">m</option>
                    <option value="in">in</option>
                  </select>
                </div>

                {formError || saveCalibrationMutation.isError ? (
                  <p className="mt-2 text-sm text-danger">
                    {formError ??
                      saveCalibrationMutation.error?.message ??
                      'Save failed'}
                  </p>
                ) : null}

                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={cancelCalibration}
                    className="px-3 py-2 text-sm text-steel hover:text-ink"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saveCalibrationMutation.isPending}
                    className="bg-signal px-4 py-2 font-display text-sm font-bold tracking-wide text-ink uppercase disabled:opacity-50"
                  >
                    {saveCalibrationMutation.isPending ? 'Saving…' : 'Save scale'}
                  </button>
                </div>
              </form>
            </div>
          ) : null}
        </div>

        {roomsPanelOpen ? (
          <div className="hidden h-full w-[380px] shrink-0 flex-col border-l border-steel-border bg-white shadow-[-8px_0_24px_rgba(0,0,0,0.12)] lg:flex">
            <ExtractedRoomsPanel
              suggestions={allAiSuggestions}
              busyId={suggestionBusyId}
              placingSuggestionId={placingAccept?.id ?? null}
              onAccept={(id, edits) => handleRequestAccept(id, edits)}
              onReject={(id) => void handleRejectSuggestion(id)}
              onRestore={(id) => void handleRestoreSuggestion(id)}
              onFocusTakeoffItem={focusTakeoffItem}
              onPromote={requestAiPromotion}
            />
          </div>
        ) : null}

        <aside className="flex h-full w-72 shrink-0 flex-col border-l border-steel-border bg-panel">
          <LayersPanel
            layers={layers}
            activeLayerId={activeLayerId}
            uncategorizedVisible={uncategorizedVisible}
            collapsed={layersCollapsed}
            onToggleCollapsed={() => setLayersCollapsed((value) => !value)}
            onSelectActive={setActiveLayerId}
            onToggleVisible={(layerId, visible) => {
              if (layerId === null) {
                setUncategorizedVisible(visible)
                return
              }
              queryClient.setQueryData(
                ['projects', projectId, 'layers'],
                (prev: Layer[] | undefined) =>
                  (prev ?? []).map((layer) =>
                    layer.id === layerId ? { ...layer, visible } : layer,
                  ),
              )
              updateLayerMutation.mutate({
                layerId,
                patch: { visible },
              })
            }}
            onAddLayer={() => {
              setLayerCreateError(null)
              setLayersCollapsed(false)
              setCreateLayerFormOpen(true)
            }}
            adding={createLayerMutation.isPending}
            showCreateForm={createLayerFormOpen}
            createError={layerCreateError}
            onCancelCreate={() => {
              if (createLayerMutation.isPending) return
              setCreateLayerFormOpen(false)
              setLayerCreateError(null)
            }}
            onSubmitCreate={(input) => {
              if (!input.name.trim() || !input.color) return
              createLayerMutation.mutate(input)
            }}
          />
          <TakeoffSidebar
            items={takeoffs}
            layers={layers}
            isLoading={takeoffQuery.isLoading}
            selectedItemId={selectedTakeoffId}
            deletingId={deletingId}
            onSelect={(itemId) => {
              setSelectedObject({ kind: 'takeoff', id: itemId })
              setTool('select')
            }}
            onRename={(itemId, label) => {
              setLocalTakeoffs((prev) =>
                (prev ?? takeoffQuery.data ?? []).map((row) =>
                  row.id === itemId ? { ...row, label } : row,
                ),
              )
              renameItemMutation.mutate({ itemId, label })
            }}
            onChangeLayer={(itemId, layerId) => {
              setLocalTakeoffs((prev) =>
                (prev ?? takeoffQuery.data ?? []).map((row) =>
                  row.id === itemId ? { ...row, layerId } : row,
                ),
              )
              reassignTakeoffLayerMutation.mutate({ itemId, layerId })
            }}
            onDelete={(itemId) => {
              const item = takeoffs.find((row) => row.id === itemId)
              if (item) {
                deleteItemMutation.mutate(item)
              }
            }}
            onTraceShape={startTraceShape}
            tracingId={tracingTakeoffId}
            highlightedItemId={highlightedTakeoffId}
            onPromote={requestTakeoffPromotion}
          />
        </aside>

        {roomsPanelOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/50"
              aria-label="Close extracted rooms overlay"
              onClick={() => {
                setRoomsPanelUserToggled(true)
                setRoomsPanelOpen(false)
              }}
            />
            <div className="absolute inset-y-0 right-0 flex w-[min(100%,400px)] flex-col border-l border-steel-border bg-white shadow-2xl">
              <ExtractedRoomsPanel
                suggestions={allAiSuggestions}
                busyId={suggestionBusyId}
                showCloseButton
                onClose={() => {
                  setRoomsPanelUserToggled(true)
                  setRoomsPanelOpen(false)
                }}
                placingSuggestionId={placingAccept?.id ?? null}
                onAccept={(id, edits) => handleRequestAccept(id, edits)}
                onReject={(id) => void handleRejectSuggestion(id)}
                onRestore={(id) => void handleRestoreSuggestion(id)}
                onFocusTakeoffItem={focusTakeoffItem}
                onPromote={requestAiPromotion}
              />
            </div>
          </div>
        ) : null}
      </div>
      {pendingPromotion ? (
        <PromoteToElementDialog
          projectId={projectId}
          measurementType={pendingPromotion.measurementType}
          sourceLabel={pendingPromotion.sourceLabel}
          value={pendingPromotion.value}
          unit={pendingPromotion.unit}
          floors={projectQuery.data?.floors ?? []}
          busy={promotionBusy}
          error={promotionError}
          onCancel={() => {
            setPendingPromotion(null)
            setPromotionError(null)
          }}
          onConfirm={(input) => void confirmPromotion(input)}
        />
      ) : null}
    </div>
  )
}
