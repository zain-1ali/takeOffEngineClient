import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addManualSelectedBoqItem, listBoqCatalogue } from '../../api/projectsApi'
import { GhostButton, PrimaryButton } from '../ui'

const UNITS = ['m³', 'm²', 'm', 'nr', 't', 'kg', 'Item']
const FALLBACK_CATEGORIES = [
  'Earthworks',
  'Blinding',
  'Waterproofing',
  'Concrete',
  'Formwork',
  'Reinforcement',
  'Masonry',
  'Other',
]
const NEW_CATEGORY = '__new__'

function uniqueInOrder(values: string[]): string[] {
  const out: string[] = []
  for (const v of values) {
    const t = v.trim()
    if (t && !out.includes(t)) out.push(t)
  }
  return out
}

export function AddManualBoqLine({
  projectId,
  floorId,
  elementKey,
  extraCategories,
}: {
  projectId: string
  floorId: string
  elementKey: string
  extraCategories?: string[]
}) {
  const qc = useQueryClient()
  const [description, setDescription] = useState('')
  const [unit, setUnit] = useState('nr')
  const [qty, setQty] = useState('')
  const [categoryPick, setCategoryPick] = useState('')
  const [customCategory, setCustomCategory] = useState('')

  const catQuery = useQuery({
    queryKey: ['boq-catalogue', projectId, elementKey, floorId],
    queryFn: () => listBoqCatalogue(projectId, { elementKey, floorId }),
    enabled: !!projectId && !!elementKey,
  })

  const categories = useMemo(() => {
    const fromCatalogue = (catQuery.data?.items || []).map((i) => i.workCategory)
    const list = uniqueInOrder([
      ...fromCatalogue,
      ...(extraCategories || []),
    ])
    if (!list.length) return FALLBACK_CATEGORIES
    if (!list.includes('Other')) list.push('Other')
    return list
  }, [catQuery.data, extraCategories])

  const resolvedCategory =
    categoryPick === NEW_CATEGORY
      ? customCategory.trim()
      : (categoryPick || categories[0] || 'Other').trim()

  const mut = useMutation({
    mutationFn: () =>
      addManualSelectedBoqItem(projectId, {
        floorId,
        elementKey,
        description: description.trim(),
        unit,
        quantity: qty === '' ? 0 : Number(qty),
        workCategory: resolvedCategory || 'Other',
      }),
    onSuccess: () => {
      setDescription('')
      setQty('')
      setCustomCategory('')
      if (categoryPick === NEW_CATEGORY) setCategoryPick('')
      void qc.invalidateQueries({ queryKey: ['reports', projectId] })
      void qc.invalidateQueries({ queryKey: ['selected-boq', projectId] })
    },
  })

  function submit() {
    if (!description.trim() || mut.isPending) return
    if (!resolvedCategory) return
    const n = qty === '' ? 0 : Number(qty)
    if (!Number.isFinite(n) || n < 0) return
    mut.mutate()
  }

  const selectValue = categoryPick || categories[0] || 'Other'

  return (
    <div className="mt-3 border border-steel-border bg-panel px-3 py-2.5">
      <p className="text-[11px] text-steel mb-2">Add a manual BOQ line</p>
      <div className="flex flex-wrap items-end gap-2">
        <label>
          <span className="block text-[10px] uppercase tracking-wide text-steel mb-0.5">
            Category
          </span>
          <select
            value={selectValue}
            onChange={(e) => setCategoryPick(e.target.value)}
            className="border border-steel-border bg-bg px-2 py-1.5 text-[13px] text-ink outline-none focus:border-signal"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value={NEW_CATEGORY}>New category…</option>
          </select>
        </label>
        {categoryPick === NEW_CATEGORY ? (
          <label className="min-w-[10rem]">
            <span className="block text-[10px] uppercase tracking-wide text-steel mb-0.5">
              New category
            </span>
            <input
              type="text"
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit()
              }}
              placeholder="e.g. Insulation"
              className="w-full border border-steel-border bg-bg px-2 py-1.5 text-[13px] text-ink outline-none focus:border-signal"
            />
          </label>
        ) : null}
        <label className="min-w-[12rem] flex-1">
          <span className="block text-[10px] uppercase tracking-wide text-steel mb-0.5">
            Description
          </span>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
            }}
            placeholder="e.g. Extra blinding, isolation joint…"
            className="w-full border border-steel-border bg-bg px-2 py-1.5 text-[13px] text-ink outline-none focus:border-signal"
          />
        </label>
        <label>
          <span className="block text-[10px] uppercase tracking-wide text-steel mb-0.5">
            Unit
          </span>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="border border-steel-border bg-bg px-2 py-1.5 text-[13px] text-ink outline-none focus:border-signal"
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="block text-[10px] uppercase tracking-wide text-steel mb-0.5">
            Qty
          </span>
          <input
            type="number"
            min={0}
            step="any"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
            }}
            placeholder="0"
            className="w-20 border border-steel-border bg-bg px-2 py-1.5 text-[13px] text-ink outline-none focus:border-signal"
          />
        </label>
        <PrimaryButton
          type="button"
          className="!px-3 !py-1.5 text-[12px]"
          disabled={
            !description.trim() ||
            mut.isPending ||
            (categoryPick === NEW_CATEGORY && !customCategory.trim())
          }
          onClick={submit}
        >
          {mut.isPending ? 'Adding…' : 'Add line'}
        </PrimaryButton>
        <GhostButton
          type="button"
          className="!px-3 !py-1.5 text-[12px]"
          onClick={() => {
            setDescription('')
            setQty('')
            setCustomCategory('')
          }}
        >
          Clear
        </GhostButton>
      </div>
      {mut.isError ? (
        <p className="mt-1.5 text-[11px] text-danger">Could not add the line.</p>
      ) : (
        <p className="mt-1.5 text-[10px] text-steel">
          The line is added under the chosen category. Leave qty at 0 and click
          Qty to open the takeoff sheet.
        </p>
      )}
    </div>
  )
}
