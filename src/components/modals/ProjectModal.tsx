import { useEffect, useMemo, useState } from 'react'
import { useAutosave } from '../../autosave/AutosaveContext'
import {
  ensureClientMaterials,
  mixesArePending,
} from '../../lib/materialsMix'
import {
  parseUnitSystem,
  unitSystemLabel,
  type UnitSystem,
} from '../../lib/units'
import type { ConcreteMix, Project, ProjectMaterials } from '../../types/api'
import { GhostButton, PrimaryButton } from '../ui'
import { ConvertCurrencyModal } from './ConvertCurrencyModal'
import { Field, Modal, inputClass } from './Modal'

const mixInputCls = `${inputClass} !py-1 !px-2 text-xs font-mono`

export function ProjectModal({
  open,
  onClose,
  project,
}: {
  open: boolean
  onClose: () => void
  project: Project
}) {
  const { schedule, flush } = useAutosave()
  const [form, setForm] = useState({
    name: project.name,
    number: project.number,
    client: project.client,
    contractor: project.contractor,
    consultant: project.consultant || '',
    location: project.location,
    currency: project.currency,
    units: project.units,
    preparedBy: project.preparedBy,
    revision: project.revision,
    date: project.date,
    gfaM2: project.gfaM2 ?? null,
    designAllowancePercent: project.designAllowancePercent ?? 6,
    overheadPercent: project.overheadPercent ?? 9,
    profitPercent: project.profitPercent ?? 5,
    inflationPercent: project.inflationPercent ?? 3.5,
  })
  const [materials, setMaterials] = useState<ProjectMaterials>(() =>
    ensureClientMaterials(project.materials),
  )
  const [earthworkBulkingPercent, setEarthworkBulkingPercent] = useState(
    (project.materials.earthworkBulkingFactor ?? 0.25) * 100,
  )
  const [convertOpen, setConvertOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm({
      name: project.name,
      number: project.number,
      client: project.client,
      contractor: project.contractor,
      consultant: project.consultant || '',
      location: project.location,
      currency: project.currency,
      units: project.units,
      preparedBy: project.preparedBy,
      revision: project.revision,
      date: project.date,
      gfaM2: project.gfaM2 ?? null,
      designAllowancePercent: project.designAllowancePercent ?? 6,
      overheadPercent: project.overheadPercent ?? 9,
      profitPercent: project.profitPercent ?? 5,
      inflationPercent: project.inflationPercent ?? 3.5,
    })
    setMaterials(ensureClientMaterials(project.materials))
    setEarthworkBulkingPercent(
      (project.materials.earthworkBulkingFactor ?? 0.25) * 100,
    )
  }, [open, project.id, project.updatedAt])

  const pending = useMemo(() => mixesArePending(materials), [materials])

  function set<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm((f) => {
      const next = { ...f, [key]: val }
      schedule({
        kind: 'project',
        projectId: project.id,
        patch: { [key]: val } as Partial<Project>,
      })
      return next
    })
  }

  function persistMaterials(next: ProjectMaterials) {
    const normalised = ensureClientMaterials(next)
    setMaterials(normalised)
    schedule({
      kind: 'project',
      projectId: project.id,
      patch: { materials: normalised },
    })
  }

  function setBulkingPercent(value: number) {
    const safeValue = Math.max(0, value)
    setEarthworkBulkingPercent(safeValue)
    persistMaterials({
      ...materials,
      earthworkBulkingFactor: safeValue / 100,
    })
  }

  function setMixField(
    grade: string,
    key: keyof ConcreteMix,
    value: number,
  ) {
    const row = {
      ...(materials.concreteMixes[grade] || {
        cement: 0,
        sand: 0,
        agg: 0,
        water: 0,
      }),
      [key]: value,
    }
    persistMaterials({
      ...materials,
      concreteMixes: { ...materials.concreteMixes, [grade]: row },
    })
  }

  return (
    <Modal
      open={open}
      title="Project settings"
      onClose={() => {
        void flush().finally(onClose)
      }}
      size="xl"
    >
      <p className="text-xs text-steel mb-3">Changes autosave to the server.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Project name">
          <input
            className={inputClass}
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
          />
        </Field>
        <Field label="Number">
          <input
            className={inputClass}
            value={form.number}
            onChange={(e) => set('number', e.target.value)}
          />
        </Field>
        <Field label="Client">
          <input
            className={inputClass}
            value={form.client}
            onChange={(e) => set('client', e.target.value)}
          />
        </Field>
        <Field label="Contractor">
          <input
            className={inputClass}
            value={form.contractor}
            onChange={(e) => set('contractor', e.target.value)}
          />
        </Field>
        <Field label="Consultant">
          <input
            className={inputClass}
            value={form.consultant}
            onChange={(e) => set('consultant', e.target.value)}
          />
        </Field>
        <Field label="Location">
          <input
            className={inputClass}
            value={form.location}
            onChange={(e) => set('location', e.target.value)}
          />
        </Field>
        <Field label="Currency (display code)">
          <div className="flex gap-2 items-center">
            <input
              className={`${inputClass} flex-1`}
              value={form.currency}
              readOnly
              title="Change currency via Convert project currency — not a live toggle"
            />
            <GhostButton
              className="!text-xs !py-1.5 !px-2 whitespace-nowrap"
              onClick={() => setConvertOpen(true)}
            >
              Convert…
            </GhostButton>
          </div>
        </Field>
        <Field label="Units (live display toggle)">
          <select
            className={inputClass}
            value={parseUnitSystem(form.units)}
            onChange={(e) => {
              const system = e.target.value as UnitSystem
              set('units', system)
            }}
          >
            <option value="metric">{unitSystemLabel('metric')}</option>
            <option value="imperial">{unitSystemLabel('imperial')}</option>
          </select>
        </Field>
        <Field label="Prepared by">
          <input
            className={inputClass}
            value={form.preparedBy}
            onChange={(e) => set('preparedBy', e.target.value)}
          />
        </Field>
        <Field label="Revision">
          <input
            className={inputClass}
            value={form.revision}
            onChange={(e) => set('revision', e.target.value)}
          />
        </Field>
        <Field label="Date">
          <input
            type="date"
            className={inputClass}
            value={form.date}
            onChange={(e) => set('date', e.target.value)}
          />
        </Field>
        <Field label="Gross Floor Area (m²)">
          <input
            type="number"
            min={0}
            step="any"
            className={inputClass}
            placeholder="Optional — enables Rate/m² on Cost Plan"
            value={form.gfaM2 ?? ''}
            onChange={(e) => {
              const raw = e.target.value
              if (raw === '') {
                set('gfaM2', null)
                return
              }
              const n = Number(raw)
              set('gfaM2', Number.isFinite(n) && n > 0 ? n : null)
            }}
          />
        </Field>
        <Field label="Design Allowance (%)">
          <input
            type="number"
            min={0}
            step="any"
            className={inputClass}
            value={form.designAllowancePercent}
            onChange={(e) =>
              set(
                'designAllowancePercent',
                Math.max(0, Number(e.target.value) || 0),
              )
            }
          />
        </Field>
        <Field label="Overhead (%)">
          <input
            type="number"
            min={0}
            step="any"
            className={inputClass}
            value={form.overheadPercent}
            onChange={(e) =>
              set('overheadPercent', Math.max(0, Number(e.target.value) || 0))
            }
          />
        </Field>
        <Field label="Profit (%)">
          <input
            type="number"
            min={0}
            step="any"
            className={inputClass}
            value={form.profitPercent}
            onChange={(e) =>
              set('profitPercent', Math.max(0, Number(e.target.value) || 0))
            }
          />
        </Field>
        <Field label="Inflation (%)">
          <input
            type="number"
            min={0}
            step="any"
            className={inputClass}
            value={form.inflationPercent}
            onChange={(e) =>
              set('inflationPercent', Math.max(0, Number(e.target.value) || 0))
            }
          />
        </Field>
        <Field label="Earthworks bulking / disposal (%)">
          <input
            type="number"
            min={0}
            step={1}
            className={inputClass}
            value={earthworkBulkingPercent}
            onChange={(e) => setBulkingPercent(Number(e.target.value) || 0)}
          />
        </Field>
      </div>

      <div className="mt-6 border-t border-steel-border pt-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">
            Formwork support allowances
          </h3>
          <p className="text-[11px] text-steel mt-1 leading-relaxed">
            Indicative kg per m² of applicable formwork (industry-typical
            placeholders — adjust per project). Same revision gate as mix ratios:
            draft edits save now; BOM uses applied rates until you bump Revision.
            Vertical bracing → foundations/walls/columns (+ beam/slab/stair/ramp
            side faces). Soffit props → beam/slab/stair/ramp soffits only.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Vertical bracing rate (kg/m²)">
            <input
              type="number"
              min={0}
              step={0.1}
              className={inputClass}
              value={materials.verticalBracingRate}
              onChange={(e) =>
                persistMaterials({
                  ...materials,
                  verticalBracingRate: Math.max(0, Number(e.target.value) || 0),
                })
              }
            />
          </Field>
          <Field label="Soffit prop rate (kg/m²)">
            <input
              type="number"
              min={0}
              step={0.1}
              className={inputClass}
              value={materials.soffitPropRate}
              onChange={(e) =>
                persistMaterials({
                  ...materials,
                  soffitPropRate: Math.max(0, Number(e.target.value) || 0),
                })
              }
            />
          </Field>
        </div>
      </div>

      <div className="mt-6 border-t border-steel-border pt-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-ink">Concrete mix ratios</h3>
          <p className="text-[11px] text-steel mt-1 leading-relaxed">
            Per m³ concrete — cement (kg), sand (m³), aggregate (m³), water (L). Spec
            §7.2 defaults load on project creation. Edits save immediately but BOM
            keeps using the mixes locked to the current revision until you bump
            Revision above. The same bump also refreshes formwork support
            allowances and Manual BOQ linked-rate snapshots.
          </p>
          {pending && (
            <p className="text-[11px] text-signal mt-2 leading-relaxed">
              Draft mixes / formwork support rates differ from revision{' '}
              {form.revision}. Change the Revision field to apply them to BOM
              going forward (includes screed and plaster mixes).
            </p>
          )}
        </div>

        <div className="border border-steel-border overflow-auto max-h-64">
          <table className="w-full text-xs">
            <thead className="bg-panel-hover text-steel uppercase tracking-wide">
              <tr>
                <th className="text-left px-2 py-1.5 font-medium">Grade</th>
                <th className="text-right px-2 py-1.5 font-medium">Cement kg</th>
                <th className="text-right px-2 py-1.5 font-medium">Sand m³</th>
                <th className="text-right px-2 py-1.5 font-medium">Agg m³</th>
                <th className="text-right px-2 py-1.5 font-medium">Water L</th>
              </tr>
            </thead>
            <tbody>
              {materials.concreteClasses.map((grade) => {
                const row = materials.concreteMixes[grade]
                return (
                  <tr key={grade} className="border-t border-steel-border">
                    <td className="px-2 py-1 font-mono text-chalk">{grade}</td>
                    {(
                      [
                        ['cement', row?.cement ?? 0],
                        ['sand', row?.sand ?? 0],
                        ['agg', row?.agg ?? 0],
                        ['water', row?.water ?? 0],
                      ] as const
                    ).map(([key, val]) => (
                      <td key={key} className="px-2 py-1 text-right">
                        <input
                          type="number"
                          step={key === 'cement' || key === 'water' ? 1 : 0.01}
                          className={`${mixInputCls} w-[4.5rem] text-right`}
                          value={val}
                          onChange={(e) =>
                            setMixField(
                              grade,
                              key,
                              parseFloat(e.target.value) || 0,
                            )
                          }
                        />
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-ink">Stone mortar</h3>
          <p className="text-[11px] text-steel mt-1 mb-3">
            Ratio label (BOQ text), mortar fraction of masonry volume, and BOM
            cement/sand per m³ mortar. Same revision gate as concrete mixes.
            Defaults are indicative — verify before procurement.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Mortar ratio label">
              <input
                className={inputClass}
                value={materials.stoneMortarRatio}
                onChange={(e) =>
                  persistMaterials({
                    ...materials,
                    stoneMortarRatio: e.target.value,
                  })
                }
              />
            </Field>
            <Field label="Mortar fraction of masonry">
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                className={inputClass}
                value={materials.stoneMortarFraction}
                onChange={(e) =>
                  persistMaterials({
                    ...materials,
                    stoneMortarFraction: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </Field>
            <Field label="Cement bags per m³ mortar">
              <input
                type="number"
                min={0}
                step={0.1}
                className={inputClass}
                value={materials.mortarMix.cementBagsPerM3}
                onChange={(e) =>
                  persistMaterials({
                    ...materials,
                    mortarMix: {
                      ...materials.mortarMix,
                      cementBagsPerM3: parseFloat(e.target.value) || 0,
                    },
                  })
                }
              />
            </Field>
            <Field label="Sand m³ per m³ mortar">
              <input
                type="number"
                min={0}
                step={0.05}
                className={inputClass}
                value={materials.mortarMix.sandM3PerM3}
                onChange={(e) =>
                  persistMaterials({
                    ...materials,
                    mortarMix: {
                      ...materials.mortarMix,
                      sandM3PerM3: parseFloat(e.target.value) || 0,
                    },
                  })
                }
              />
            </Field>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-ink">Floor screed mix</h3>
          <p className="text-[11px] text-steel mt-1 mb-3">
            Per m³ screed — cement (kg) and sand (m³). Default ~1:4 by volume
            (indicative, verify before procurement). Same revision gate as
            concrete mixes.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Cement kg per m³ screed">
              <input
                type="number"
                min={0}
                step={1}
                className={inputClass}
                value={materials.screedMix.cementKgPerM3}
                onChange={(e) =>
                  persistMaterials({
                    ...materials,
                    screedMix: {
                      ...materials.screedMix,
                      cementKgPerM3: parseFloat(e.target.value) || 0,
                    },
                  })
                }
              />
            </Field>
            <Field label="Sand m³ per m³ screed">
              <input
                type="number"
                min={0}
                step={0.05}
                className={inputClass}
                value={materials.screedMix.sandM3PerM3}
                onChange={(e) =>
                  persistMaterials({
                    ...materials,
                    screedMix: {
                      ...materials.screedMix,
                      sandM3PerM3: parseFloat(e.target.value) || 0,
                    },
                  })
                }
              />
            </Field>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-ink">Plaster mix</h3>
          <p className="text-[11px] text-steel mt-1 mb-3">
            Per m³ plaster — cement (kg) and sand (m³). Default ~1:4–1:5 by
            volume (indicative, verify before procurement). Same revision gate
            as concrete mixes.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Cement kg per m³ plaster">
              <input
                type="number"
                min={0}
                step={1}
                className={inputClass}
                value={materials.plasterMix.cementKgPerM3}
                onChange={(e) =>
                  persistMaterials({
                    ...materials,
                    plasterMix: {
                      ...materials.plasterMix,
                      cementKgPerM3: parseFloat(e.target.value) || 0,
                    },
                  })
                }
              />
            </Field>
            <Field label="Sand m³ per m³ plaster">
              <input
                type="number"
                min={0}
                step={0.05}
                className={inputClass}
                value={materials.plasterMix.sandM3PerM3}
                onChange={(e) =>
                  persistMaterials({
                    ...materials,
                    plasterMix: {
                      ...materials.plasterMix,
                      sandM3PerM3: parseFloat(e.target.value) || 0,
                    },
                  })
                }
              />
            </Field>
          </div>
        </div>
      </div>

      {(project.currencyConversionLog?.length || 0) > 0 && (
        <div className="mt-4 border-t border-steel-border pt-3">
          <h3 className="text-xs font-semibold text-ink mb-2">Currency conversion log</h3>
          <ul className="text-[11px] text-steel space-y-1 max-h-28 overflow-auto">
            {[...(project.currencyConversionLog || [])]
              .slice()
              .reverse()
              .map((e) => (
                <li key={e.id} className="font-mono">
                  {e.fromCurrency}→{e.toCurrency} @ {e.rateUsed} ({e.rateDate})
                </li>
              ))}
          </ul>
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <PrimaryButton
          className="!text-sm !py-1.5 !px-4"
          onClick={() => {
            void flush().finally(onClose)
          }}
        >
          Done
        </PrimaryButton>
      </div>

      <ConvertCurrencyModal
        open={convertOpen}
        onClose={() => setConvertOpen(false)}
        project={project}
      />
    </Modal>
  )
}
