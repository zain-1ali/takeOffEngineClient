import type { Instance } from '../../types/api'
import type { ImagePoint } from '../measurementMath'
import type { TakeoffType } from '../../types/models'
import {
  autoPrim,
  newTakeoffLineId,
  type TakeoffLine,
  type TakeoffPrim,
} from './measurement'

export type TakeoffPdfCapture = {
  kind: string
  value: number
  points: ImagePoint[]
  sheetId: string
  label: string
}

export function syntheticTakeoffMeasureInstance(opts: {
  floorId: string
  mark: string
  prim: TakeoffPrim
}): { instance: Instance; fieldKey: string } {
  const base = {
    id: 'takeoff-pdf-measure',
    floorId: opts.floorId,
    mark: opts.mark || 'TAKEOFF',
    count: 1,
    geometry: {},
    concreteGrade: null,
    reinforcement: null,
    spec: null,
    location: null,
  }
  if (opts.prim === 'count') {
    return {
      instance: { ...base, elementKey: 'PAD_FOOTING', shape: 'RECTANGULAR' },
      fieldKey: 'count',
    }
  }
  if (opts.prim === 'linear') {
    return {
      instance: { ...base, elementKey: 'BEAMS', shape: 'RECTANGULAR' },
      fieldKey: 'spanLength',
    }
  }
  return {
    instance: { ...base, elementKey: 'PAD_FOOTING', shape: 'RECTANGULAR' },
    fieldKey: 'length',
  }
}

export function capturePrim(kind: string, unitHint?: TakeoffPrim): TakeoffPrim {
  const k = String(kind || '').toUpperCase()
  if (k === 'COUNT') return 'count'
  if (k === 'LINEAR' || k === 'ARC' || k === 'CURVED_PATH' || k === 'POLYLINE') {
    return 'linear'
  }
  if (unitHint === 'volume') return 'volume'
  return 'area'
}

export function takeoffItemTypeForKind(kind: string): TakeoffType {
  const prim = capturePrim(kind)
  if (prim === 'count') return 'COUNT'
  if (prim === 'linear') return 'LINEAR'
  return 'AREA'
}

export function takeoffLineFromCapture(
  capture: TakeoffPdfCapture,
  unit: string,
  existingId?: string,
): TakeoffLine {
  const prim = capturePrim(capture.kind, autoPrim(unit))
  const id = existingId || newTakeoffLineId()
  const ded = String(capture.kind).toUpperCase() === 'DEDUCTION'
  const base: TakeoffLine = {
    id,
    label: capture.label,
    ded,
    nr: 1,
    shape: 'direct',
    dims: {},
    depth: '',
    direct: { value: capture.value, prim },
    pdfSheetId: capture.sheetId,
  }
  if (prim === 'linear' && !ded) {
    return {
      ...base,
      shape: 'linear',
      dims: { a: capture.value },
      direct: { value: '', prim: 'area' },
    }
  }
  if (prim === 'count') {
    return {
      ...base,
      nr: capture.value,
      direct: { value: capture.value, prim: 'count' },
    }
  }
  return base
}
