import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  confirmCurrencyConversion,
  quoteCurrencyConversion,
  type CurrencyQuote,
} from '../../api/projectsApi'
import { ApiError } from '../../lib/api'
import type { Project } from '../../types/api'
import { GhostButton, PrimaryButton } from '../ui'
import { Field, Modal, inputClass } from './Modal'

import { PROJECT_CURRENCIES } from '../../constants/currencies'

export function ConvertCurrencyModal({
  open,
  onClose,
  project,
}: {
  open: boolean
  onClose: () => void
  project: Project
}) {
  const qc = useQueryClient()
  const [toCurrency, setToCurrency] = useState(
    PROJECT_CURRENCIES.find((c) => c !== project.currency) || 'RWF',
  )
  const [quote, setQuote] = useState<CurrencyQuote | null>(null)
  const [error, setError] = useState<string | null>(null)

  const quoteMut = useMutation({
    mutationFn: () => quoteCurrencyConversion(project.id, toCurrency),
    onSuccess: (data) => {
      setQuote(data.quote)
      setError(null)
    },
    onError: (err) => {
      setQuote(null)
      setError(err instanceof ApiError ? err.message : 'Could not fetch exchange rate')
    },
  })

  const confirmMut = useMutation({
    mutationFn: () => {
      if (!quote) throw new Error('No quote')
      return confirmCurrencyConversion(project.id, quote.quoteId)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['project', project.id] })
      void qc.invalidateQueries({ queryKey: ['reports'] })
      void qc.invalidateQueries({ queryKey: ['boq-pack', project.id] })
      void qc.invalidateQueries({ queryKey: ['pack-resources', project.id] })
      void qc.invalidateQueries({ queryKey: ['pack-analyses', project.id] })
      void qc.invalidateQueries({ queryKey: ['pack-analysis', project.id] })
      setQuote(null)
      onClose()
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Conversion failed')
    },
  })

  function reset() {
    setQuote(null)
    setError(null)
    quoteMut.reset()
    confirmMut.reset()
  }

  return (
    <Modal
      open={open}
      title="Convert project currency"
      onClose={() => {
        reset()
        onClose()
      }}
    >
      <div className="space-y-4">
        <p className="text-xs text-steel leading-relaxed">
          This is an explicit, logged action — not a live toggle. On confirm, databank
          unit rates, RATE ANALYSIS totals, Rates Schedule composites, the mix rate
          library, and typed contract value are multiplied by the fetched rate. Includes
          RWF and other East African currencies. Values never change from daily
          fluctuation in the background.
        </p>

        <Field label={`Current currency: ${project.currency}`}>
          <select
            className={inputClass}
            value={toCurrency}
            disabled={!!quote || quoteMut.isPending}
            onChange={(e) => {
              setToCurrency(e.target.value)
              setQuote(null)
              setError(null)
            }}
          >
            {PROJECT_CURRENCIES.filter((c) => c !== project.currency).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>

        {error && <p className="text-sm text-danger">{error}</p>}

        {quote && (
          <div className="border border-steel-border bg-panel-hover px-3 py-3 text-sm text-ink">
            1 {quote.fromCurrency} = {quote.rate} {quote.toCurrency} as of{' '}
            {quote.rateDate} — this will convert all priced values in this project
            (databank, rate analysis, BOQ rates, mix library). Continue?
          </div>
        )}

        <div className="flex justify-end gap-2">
          <GhostButton
            className="!text-xs !py-1.5 !px-3"
            onClick={() => {
              reset()
              onClose()
            }}
          >
            Cancel
          </GhostButton>
          {!quote ? (
            <PrimaryButton
              className="!text-xs !py-2"
              disabled={quoteMut.isPending}
              onClick={() => quoteMut.mutate()}
            >
              {quoteMut.isPending ? 'Fetching rate…' : 'Fetch rate'}
            </PrimaryButton>
          ) : (
            <>
              <GhostButton
                className="!text-xs !py-1.5 !px-3"
                onClick={() => {
                  setQuote(null)
                  setError(null)
                }}
              >
                Back
              </GhostButton>
              <PrimaryButton
                className="!text-xs !py-2"
                disabled={confirmMut.isPending}
                onClick={() => confirmMut.mutate()}
              >
                {confirmMut.isPending ? 'Converting…' : 'Confirm conversion'}
              </PrimaryButton>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}
