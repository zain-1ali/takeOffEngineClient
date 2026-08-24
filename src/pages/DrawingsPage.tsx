import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getProject } from '../api/projectsApi'
import {
  fetchSheets,
  reorderSheets,
  updateSheet,
  uploadPdfs,
} from '../api/sheets'
import { SheetNavigator } from '../components/SheetNavigator'
import {
  downloadProjectMarkedPdf,
  downloadProjectTakeoffCsv,
} from '../api/exportPdf'

export default function DrawingsPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sheetCountAtUploadRef = useRef(0)
  const [uploadMessage, setUploadMessage] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadDiscipline, setUploadDiscipline] = useState('Other')
  const [awaitingPdfProcessing, setAwaitingPdfProcessing] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [markedPdfBusy, setMarkedPdfBusy] = useState(false)
  const [csvBusy, setCsvBusy] = useState(false)

  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
    enabled: Boolean(projectId),
  })

  const sheetsQuery = useQuery({
    queryKey: ['projects', projectId, 'sheets'],
    queryFn: () => fetchSheets(projectId),
    enabled: Boolean(projectId),
    refetchInterval: (query) => {
      if (awaitingPdfProcessing) return 2500
      const extracting = (query.state.data ?? []).some(
        (sheet) =>
          sheet.aiExtractionStatus === 'pending' ||
          sheet.aiExtractionStatus === 'processing',
      )
      return extracting ? 2500 : false
    },
  })

  const uploadMutation = useMutation({
    mutationFn: (files: File[]) =>
      uploadPdfs(projectId, files, uploadDiscipline),
    onSuccess: async (result) => {
      const fileLabel =
        (result.fileCount ?? 1) > 1 ? `${result.fileCount} PDFs` : 'PDF'
      setUploadError(null)
      if (result.status === 'processing') {
        sheetCountAtUploadRef.current = sheetsQuery.data?.length ?? 0
        setAwaitingPdfProcessing(true)
        setUploadMessage(`Uploading ${fileLabel} — converting pages into sheets…`)
        window.setTimeout(() => {
          setAwaitingPdfProcessing((stillWaiting) => {
            if (stillWaiting) {
              setUploadMessage(
                'Conversion is taking longer than usual — sheets will appear when ready.',
              )
            }
            return stillWaiting
          })
        }, 120_000)
      } else {
        setAwaitingPdfProcessing(false)
        setUploadMessage(
          `Uploaded ${fileLabel} → ${result.pageCount ?? 0} sheet${
            (result.pageCount ?? 0) === 1 ? '' : 's'
          }.`,
        )
      }
      await queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'sheets'],
      })
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    onError: (error: Error) => {
      setAwaitingPdfProcessing(false)
      setUploadMessage(null)
      setUploadError(error.message)
    },
  })

  const isConvertingPdf = uploadMutation.isPending || awaitingPdfProcessing

  useEffect(() => {
    if (!awaitingPdfProcessing) return
    const currentCount = sheetsQuery.data?.length ?? 0
    if (currentCount > sheetCountAtUploadRef.current) {
      const added = currentCount - sheetCountAtUploadRef.current
      setAwaitingPdfProcessing(false)
      setUploadMessage(
        `Conversion complete — ${added} sheet${added === 1 ? '' : 's'} ready.`,
      )
    }
  }, [awaitingPdfProcessing, sheetsQuery.data])

  const updateSheetMutation = useMutation({
    mutationFn: (payload: {
      sheetId: string
      patch: { name?: string; discipline?: string }
    }) => updateSheet(payload.sheetId, payload.patch),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'sheets'],
      })
    },
  })

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: string[]) => reorderSheets(projectId, orderedIds),
    onSuccess: async (sheets) => {
      queryClient.setQueryData(['projects', projectId, 'sheets'], sheets)
    },
  })

  function handleFileChange(event: ChangeEvent<HTMLInputElement>): void {
    const list = event.target.files
    if (!list || list.length === 0) return
    setUploadMessage(null)
    setUploadError(null)
    uploadMutation.mutate([...list])
  }

  if (projectQuery.isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8">
        <p className="font-display text-sm tracking-wide text-steel uppercase">
          Loading project…
        </p>
      </div>
    )
  }

  if (projectQuery.isError || !projectQuery.data) {
    return (
      <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8">
        <p className="text-sm text-danger">
          {projectQuery.error?.message ?? 'Project not found'}
        </p>
        <Link
          to="/"
          className="mt-6 inline-block font-display text-sm font-bold text-chalk underline decoration-2 underline-offset-4"
        >
          Back to projects
        </Link>
      </div>
    )
  }

  const project = projectQuery.data.project
  const sheets = sheetsQuery.data ?? []
  const sheetCount = sheets.length

  return (
    <div className="mx-auto max-w-5xl px-5 pb-16 pt-8 sm:px-8 sm:pt-10">
      <nav className="anim-rise mb-8 flex flex-wrap items-center gap-4">
        <Link
          to={`/projects/${projectId}`}
          className="inline-flex items-center gap-2 text-sm text-steel transition hover:text-ink"
        >
          <span aria-hidden>←</span>
          <span className="font-display font-semibold tracking-wide uppercase">
            Workspace
          </span>
        </Link>
      </nav>

      <header className="anim-rise anim-rise-delay-1 mb-10">
        <p className="font-display text-[0.7rem] font-bold tracking-[0.28em] text-chalk uppercase">
          Drawings
        </p>
        <h1 className="font-display mt-2 text-4xl leading-[1.05] font-extrabold tracking-tight text-ink sm:text-5xl">
          {project.name}
        </h1>
        <div className="brand-underline mt-4 h-[3px] w-20 bg-signal" />
        <p className="mt-4 text-sm leading-relaxed text-steel">
          Upload one or more PDF blueprints — each page becomes a sheet. Open a
          sheet to pan, zoom, and calibrate scale.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            to={`/projects/${projectId}/quantity-takeoff`}
            className="border border-steel-border bg-bg px-4 py-2 font-display text-xs font-bold tracking-wide text-ink uppercase hover:border-ink"
          >
            Quantity Takeoff Table
          </Link>
          <button
            type="button"
            disabled={markedPdfBusy || sheetCount === 0}
            onClick={() => {
              setExportError(null)
              setMarkedPdfBusy(true)
              void downloadProjectMarkedPdf(projectId)
                .catch((error: unknown) => {
                  setExportError(
                    error instanceof Error
                      ? error.message
                      : 'Marked-up PDF export failed',
                  )
                })
                .finally(() => setMarkedPdfBusy(false))
            }}
            className="border border-steel-border bg-bg px-4 py-2 font-display text-xs font-bold tracking-wide text-ink uppercase hover:border-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            {markedPdfBusy ? 'Exporting PDF…' : 'Export Marked-up PDF'}
          </button>
          <button
            type="button"
            disabled={csvBusy}
            onClick={() => {
              setExportError(null)
              setCsvBusy(true)
              void downloadProjectTakeoffCsv(projectId)
                .catch((error: unknown) => {
                  setExportError(
                    error instanceof Error
                      ? error.message
                      : 'CSV export failed',
                  )
                })
                .finally(() => setCsvBusy(false))
            }}
            className="bg-ink px-4 py-2 font-display text-xs font-bold tracking-wide text-bg uppercase hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {csvBusy ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
        {exportError ? (
          <p className="mt-2 text-sm text-danger">{exportError}</p>
        ) : null}
      </header>

      <section className="anim-rise anim-rise-delay-2 mb-14 border border-steel-border bg-panel text-ink">
        <div className="grid gap-0 lg:grid-cols-[1.1fr_1fr]">
          <div className="border-b border-steel-border px-6 py-7 lg:border-r lg:border-b-0 lg:px-8">
            <h2 className="font-display text-xl font-bold tracking-tight">
              Upload blueprints
            </h2>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-steel">
              Select multiple PDFs or one multi-page set. New sheets append to
              this project — nothing is replaced.
            </p>
            <label className="mt-4 block text-xs text-steel">
              Default discipline for this upload
              <select
                value={uploadDiscipline}
                onChange={(event) => setUploadDiscipline(event.target.value)}
                className="mt-1 w-full border border-steel-border bg-bg px-2 py-1.5 text-sm text-ink outline-none"
              >
                <option value="Architectural">Architectural</option>
                <option value="Electrical">Electrical</option>
                <option value="Plumbing">Plumbing</option>
                <option value="Structural">Structural</option>
                <option value="Other">Other</option>
              </select>
            </label>
          </div>

          <div className="flex flex-col justify-center px-6 py-7 lg:px-8">
            <label
              htmlFor="pdf-upload"
              className={`relative flex flex-col items-start gap-3 border border-dashed px-5 py-6 transition ${
                isConvertingPdf
                  ? 'cursor-wait border-signal/45 bg-bg/40'
                  : 'cursor-pointer border-steel-border bg-bg/40 hover:border-signal'
              }`}
            >
              <span className="font-display text-sm font-bold tracking-wide text-signal uppercase">
                {isConvertingPdf ? 'Processing PDF…' : 'Choose PDF(s)'}
              </span>
              <span className="text-xs text-steel">
                {isConvertingPdf
                  ? 'Pages are rendering — this can take a minute for large plans.'
                  : 'Multi-select supported — each page becomes a sheet.'}
              </span>
              <input
                id="pdf-upload"
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                multiple
                onChange={handleFileChange}
                disabled={isConvertingPdf}
                className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-wait"
              />
            </label>

            {isConvertingPdf ? (
              <div className="mt-4 border border-signal/25 bg-bg/40 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-display text-xs font-bold tracking-wide text-signal uppercase">
                    {uploadMutation.isPending ? 'Uploading…' : 'Converting pages…'}
                  </p>
                  <span className="inline-flex items-center gap-1" aria-hidden>
                    <span className="ai-extracting-dot h-1.5 w-1.5 rounded-full bg-signal" />
                    <span className="ai-extracting-dot h-1.5 w-1.5 rounded-full bg-signal" />
                    <span className="ai-extracting-dot h-1.5 w-1.5 rounded-full bg-signal" />
                  </span>
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden bg-steel-border">
                  <div className="upload-pulse h-full w-full bg-signal" />
                </div>
                <p className="mt-2 text-xs leading-relaxed text-steel">
                  {uploadMessage ?? 'Rendering blueprint pages into takeoff sheets.'}
                </p>
              </div>
            ) : null}

            {!isConvertingPdf && uploadMessage ? (
              <p className="mt-3 text-sm text-verified">{uploadMessage}</p>
            ) : null}

            {uploadError ? (
              <p className="mt-3 text-sm text-danger">{uploadError}</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="anim-rise anim-rise-delay-3">
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <h2 className="font-display text-xl font-bold tracking-tight text-ink">
            Sheet navigator
          </h2>
          {!sheetsQuery.isLoading ? (
            <span className="text-xs tracking-wide text-steel uppercase">
              {sheetCount} sheet{sheetCount === 1 ? '' : 's'}
            </span>
          ) : null}
        </div>

        {sheetsQuery.isLoading ? (
          <p className="text-sm text-steel">Loading sheets…</p>
        ) : null}

        {sheetsQuery.isError ? (
          <p className="text-sm text-danger">{sheetsQuery.error.message}</p>
        ) : null}

        {!sheetsQuery.isLoading && !sheetsQuery.isError ? (
          <SheetNavigator
            projectId={projectId}
            sheets={sheets}
            onRename={(sheetId, name) =>
              updateSheetMutation.mutate({ sheetId, patch: { name } })
            }
            onDisciplineChange={(sheetId, discipline) =>
              updateSheetMutation.mutate({ sheetId, patch: { discipline } })
            }
            onReorder={(orderedIds) => {
              const byId = new Map(sheets.map((sheet) => [sheet.id, sheet]))
              const next = orderedIds
                .map((id, index) => {
                  const sheet = byId.get(id)
                  return sheet ? { ...sheet, sortOrder: index } : null
                })
                .filter((row): row is (typeof sheets)[number] => row != null)
              queryClient.setQueryData(['projects', projectId, 'sheets'], next)
              reorderMutation.mutate(orderedIds)
            }}
          />
        ) : null}
      </section>
    </div>
  )
}
