import type { AiSuggestion, AiSuggestionConfidence } from "../types/models";
import {
  DEFAULT_UNIT_SYSTEM,
  formatArea,
  formatDimensionPair,
  formatLength,
} from "../lib/unitConversion";

function confidenceClass(confidence: AiSuggestionConfidence): string {
  switch (confidence) {
    case "high":
      return "border-emerald-400/60 bg-emerald-500/15 text-emerald-100";
    case "medium":
      return "border-amber-400/60 bg-amber-500/15 text-amber-100";
    case "low":
      return "border-red-400/60 bg-red-500/15 text-red-100";
    default:
      return "border-white/20 bg-white/10 text-paper/80";
  }
}

interface AiRoomPinPopoverProps {
  suggestion: AiSuggestion;
  onClose: () => void;
}

export function AiRoomPinPopover({
  suggestion,
  onClose,
}: AiRoomPinPopoverProps) {
  const dims =
    suggestion.dimensionA != null && suggestion.dimensionB != null
      ? formatDimensionPair(
          suggestion.dimensionA,
          suggestion.dimensionB,
          suggestion.dimensionUnit,
          DEFAULT_UNIT_SYSTEM
        )
      : suggestion.dimensionsRaw ?? "—";

  return (
    <div
      className="w-[min(16rem,calc(100vw-2rem))] border border-cyan-400/40 bg-ink/95 p-3 text-paper-bright shadow-xl"
      role="dialog"
      aria-label={`AI room: ${suggestion.label}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-display text-sm font-bold tracking-wide text-paper-bright">
          {suggestion.label}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 px-1 text-xs text-paper/50 hover:text-paper-bright"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <span
        className={`mt-2 inline-block border px-1.5 py-0.5 text-[0.6rem] font-semibold tracking-wide uppercase ${confidenceClass(suggestion.confidence)}`}
      >
        {suggestion.confidence} confidence
      </span>

      <dl className="mt-3 space-y-1.5 text-xs text-paper/85">
        <div className="flex justify-between gap-3">
          <dt className="text-paper/55">Dimensions</dt>
          <dd className="text-right tabular-nums">{dims}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-paper/55">Area</dt>
          <dd className="text-right tabular-nums">
            {suggestion.calculatedArea == null
              ? "—"
              : formatArea(
                  suggestion.calculatedArea,
                  DEFAULT_UNIT_SYSTEM,
                  suggestion.dimensionUnit
                )}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-paper/55">Perimeter</dt>
          <dd className="text-right tabular-nums">
            {suggestion.calculatedPerimeter == null
              ? "—"
              : formatLength(
                  suggestion.calculatedPerimeter,
                  DEFAULT_UNIT_SYSTEM,
                  suggestion.dimensionUnit
                )}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-paper/55">Status</dt>
          <dd className="text-right capitalize">{suggestion.status.toLowerCase()}</dd>
        </div>
      </dl>
    </div>
  );
}
