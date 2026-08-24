import { api } from '../lib/api'
import type { Layer } from '../types/models'

interface LayersResponse {
  layers: Layer[]
}

interface LayerResponse {
  layer: Layer
}

export interface CreateLayerInput {
  name: string
  color: string
}

export interface UpdateLayerInput {
  name?: string
  color?: string
  visible?: boolean
  sortOrder?: number
}

export async function fetchLayers(projectId: string): Promise<Layer[]> {
  const data = await api<LayersResponse>(`/api/projects/${projectId}/layers`)
  return data.layers
}

export async function createLayer(
  projectId: string,
  input: CreateLayerInput,
): Promise<Layer> {
  const data = await api<LayerResponse>(`/api/projects/${projectId}/layers`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return data.layer
}

export async function updateLayer(
  projectId: string,
  layerId: string,
  input: UpdateLayerInput,
): Promise<Layer> {
  const data = await api<LayerResponse>(
    `/api/projects/${projectId}/layers/${layerId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  )
  return data.layer
}

export async function deleteLayer(
  projectId: string,
  layerId: string,
): Promise<Layer> {
  const data = await api<LayerResponse>(
    `/api/projects/${projectId}/layers/${layerId}`,
    { method: 'DELETE' },
  )
  return data.layer
}
