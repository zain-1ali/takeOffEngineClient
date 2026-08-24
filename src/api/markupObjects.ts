import { api } from '../lib/api'
import type { MarkupGeometry } from '../lib/markupGeometry'
import type { MarkupObject, MarkupType } from '../types/models'

export interface CreateMarkupInput {
  type: MarkupType
  data: MarkupGeometry
  color: string
  strokeWidth: number
  textContent?: string | null
  layerId?: string | null
}

export type UpdateMarkupInput = Partial<CreateMarkupInput>

export async function fetchMarkups(sheetId: string): Promise<MarkupObject[]> {
  const data = await api<{ markups: MarkupObject[] }>(
    `/api/sheets/${sheetId}/markups`,
  )
  return data.markups
}

export async function createMarkup(
  sheetId: string,
  input: CreateMarkupInput,
): Promise<MarkupObject> {
  const data = await api<{ markup: MarkupObject }>(
    `/api/sheets/${sheetId}/markups`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
  return data.markup
}

export async function updateMarkup(
  sheetId: string,
  markupId: string,
  input: UpdateMarkupInput,
): Promise<MarkupObject> {
  const data = await api<{ markup: MarkupObject }>(
    `/api/sheets/${sheetId}/markups/${markupId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  )
  return data.markup
}

export async function deleteMarkup(
  sheetId: string,
  markupId: string,
): Promise<MarkupObject> {
  const data = await api<{ markup: MarkupObject }>(
    `/api/sheets/${sheetId}/markups/${markupId}`,
    { method: 'DELETE' },
  )
  return data.markup
}
