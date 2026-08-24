import { api } from '../lib/api'
import type { ImagePoint } from '../lib/measurementMath'
import type { TakeoffItem, TakeoffType } from '../types/models'

export interface CreateTakeoffItemInput {
  type: TakeoffType
  points: ImagePoint[]
  color: string
  label?: string
  layerId?: string | null
  conditionId?: string | null
}

export interface UpdateTakeoffItemInput {
  label?: string | null
  layerId?: string | null
  conditionId?: string | null
  points?: ImagePoint[]
  source?: 'MANUAL' | 'AI_SUGGESTED'
}

export async function fetchTakeoffItems(sheetId: string): Promise<TakeoffItem[]> {
  const data = await api<{ items: TakeoffItem[] }>(
    `/api/sheets/${sheetId}/takeoff-items`,
  )
  return data.items
}

export async function createTakeoffItem(
  sheetId: string,
  input: CreateTakeoffItemInput,
): Promise<TakeoffItem> {
  const data = await api<{ item: TakeoffItem }>(
    `/api/sheets/${sheetId}/takeoff-items`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
  return data.item
}

export async function updateTakeoffItem(
  sheetId: string,
  itemId: string,
  input: UpdateTakeoffItemInput,
): Promise<TakeoffItem> {
  const data = await api<{ item: TakeoffItem }>(
    `/api/sheets/${sheetId}/takeoff-items/${itemId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  )
  return data.item
}

export async function deleteTakeoffItem(
  sheetId: string,
  itemId: string,
): Promise<TakeoffItem> {
  const data = await api<{ item: TakeoffItem }>(
    `/api/sheets/${sheetId}/takeoff-items/${itemId}`,
    { method: 'DELETE' },
  )
  return data.item
}
