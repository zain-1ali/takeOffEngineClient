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

const TARGETS = ['USD', 'EUR', 'GBP', 'CHF', 'CAD', 'AUD', 'JPY', 'KES', 'UGX', 'ZAR']

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
    TARGETS.find((c) => c !== project.currency) || 'EUR',
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
          This is an explicit, logged action — not a live toggle. On confirm, every
          rate-bank unit cost is multiplied by the fetched exchange rate, the project
          currency updates, and an audit log entry is stored. Values never change from
          daily rate fluctuation in the background.
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
            {TARGETS.filter((c) => c !== project.currency).map((c) => (
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
            {quote.rateDate} — this will convert all rate items and priced values in
            this project. Continue?
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
