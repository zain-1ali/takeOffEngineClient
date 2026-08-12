import {
  REPORT_THEMES,
  type ReportThemeId,
  resolveReportTheme,
} from '../../lib/reportThemes'

export function ReportThemePicker({
  value,
  onChange,
}: {
  value: ReportThemeId | string | null | undefined
  onChange: (id: ReportThemeId) => void
}) {
  const selected = resolveReportTheme(value).id

  return (
    <div className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold text-ink">Report theme</h3>
        <p className="text-[12px] text-steel mt-0.5">
          Colors apply to the Cost Plan preview and PDF export
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        {REPORT_THEMES.map((theme) => {
          const isSelected = theme.id === selected
          const { primary, secondary, tertiary, tint, paper } = theme.colors
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => onChange(theme.id)}
              className={`relative text-left border p-3 transition-colors ${
                isSelected
                  ? 'border-ink bg-panel-hover ring-1 ring-ink'
                  : 'border-steel-border bg-panel hover:border-ink/40'
              }`}
            >
              {isSelected && (
                <span
                  className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full text-white text-[11px]"
                  style={{ backgroundColor: primary }}
                  aria-label="Selected"
                >
                  ✓
                </span>
              )}
              <p className="text-[13px] font-semibold text-ink pr-6">{theme.name}</p>
              <div className="mt-2.5 flex h-7 overflow-hidden border border-steel-border/60">
                {[primary, secondary, tertiary, tint, paper].map((c, i) => (
                  <span
                    key={i}
                    className="flex-1"
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>
              <p className="mt-1.5 text-[10px] font-mono text-steel truncate">
                {primary} · {secondary}
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
