import { useEffect, useMemo, useState } from "react";
import type { AiSuggestion, AiSuggestionConfidence } from "../types/models";
import {
  DEFAULT_UNIT_SYSTEM,
  formatArea,
  formatDimensionPair,
  formatLength,
} from "../lib/unitConversion";
import type { AcceptAiSuggestionEdits } from "../api/aiSuggestions";

type RoomsTab = "PENDING" | "ACCEPTED" | "REJECTED";

interface ExtractedRoomsPanelProps {
  suggestions: AiSuggestion[];
  busyId: string | null;
  placingSuggestionId?: string | null;
  onClose?: () => void;
  showCloseButton?: boolean;
  /** Starts click-to-locate accept flow (does not call API until canvas click). */
  onAccept: (id: string, edits: AcceptAiSuggestionEdits) => void;
  onReject: (id: string) => void;
  onRestore: (id: string) => void;
  onFocusTakeoffItem: (takeoffItemId: string) => void;
  onPromote: (suggestion: AiSuggestion) => void;
}

function confidenceClass(confidence: AiSuggestionConfidence): string {
  switch (confidence) {
    case "high":
      return "border-emerald-300 bg-emerald-50 text-emerald-800";
    case "medium":
      return "border-amber-300 bg-amber-50 text-amber-800";
    case "low":
      return "border-red-300 bg-red-50 text-red-700";
    default:
      return "border-gray-200 bg-gray-50 text-gray-700";
  }
}

interface RowDraft {
  label: string;
  dimensionA: string;
  dimensionB: string;
  calculatedArea: string;
  calculatedPerimeter: string;
}

function toDraft(suggestion: AiSuggestion): RowDraft {
  return {
    label: suggestion.label,
    dimensionA:
      suggestion.dimensionA != null ? String(suggestion.dimensionA) : "",
    dimensionB:
      suggestion.dimensionB != null ? String(suggestion.dimensionB) : "",
    calculatedArea:
      suggestion.calculatedArea != null
        ? String(suggestion.calculatedArea)
        : "",
    calculatedPerimeter:
      suggestion.calculatedPerimeter != null
        ? String(suggestion.calculatedPerimeter)
        : "",
  };
}

function parseOptional(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

const inputClass =
  "w-full border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";

export function ExtractedRoomsPanel({
  suggestions,
  busyId,
  placingSuggestionId = null,
  onClose,
  showCloseButton = false,
  onAccept,
  onReject,
  onRestore,
  onFocusTakeoffItem,
  onPromote,
}: ExtractedRoomsPanelProps) {
  const pending = useMemo(
    () => suggestions.filter((row) => row.status === "PENDING"),
    [suggestions]
  );
  const accepted = useMemo(
    () => suggestions.filter((row) => row.status === "ACCEPTED"),
    [suggestions]
  );
  const rejected = useMemo(
    () => suggestions.filter((row) => row.status === "REJECTED"),
    [suggestions]
  );

  const [tab, setTab] = useState<RoomsTab>("PENDING");
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});

  useEffect(() => {
    setDrafts((prev) => {
      const next: Record<string, RowDraft> = {};
      for (const suggestion of pending) {
        next[suggestion.id] = prev[suggestion.id] ?? toDraft(suggestion);
      }
      return next;
    });
  }, [pending]);

  useEffect(() => {
    if (tab === "PENDING" && pending.length === 0 && accepted.length > 0) {
      setTab("ACCEPTED");
    } else if (
      tab === "PENDING" &&
      pending.length === 0 &&
      rejected.length > 0 &&
      accepted.length === 0
    ) {
      setTab("REJECTED");
    }
  }, [tab, pending.length, accepted.length, rejected.length]);

  function updateDraft(id: string, patch: Partial<RowDraft>): void {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] ?? toDraft(pending.find((s) => s.id === id)!)),
        ...patch,
      },
    }));
  }

  const tabs: Array<{ id: RoomsTab; label: string; count: number }> = [
    { id: "PENDING", label: "Pending", count: pending.length },
    { id: "ACCEPTED", label: "Accepted", count: accepted.length },
    { id: "REJECTED", label: "Rejected", count: rejected.length },
  ];

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-white text-gray-900">
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-gray-200 px-4 py-3">
        <div className="min-w-0">
          <h2 className="font-display text-sm font-bold tracking-wide text-gray-900 uppercase">
            Extracted Rooms
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Review AI room data. Shapes are optional via Trace Shape.
          </p>
        </div>
        {showCloseButton && onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-700 uppercase hover:bg-gray-50"
            aria-label="Close extracted rooms panel"
          >
            Close
          </button>
        ) : null}
      </div>

      {placingSuggestionId ? (
        <div className="shrink-0 border-b border-cyan-200 bg-cyan-50 px-4 py-2 text-xs text-cyan-950">
          <span className="font-semibold">Click to locate:</span> click once on
          the blueprint for this room. Press{" "}
          <kbd className="rounded border border-cyan-300 bg-white px-1">Esc</kbd>{" "}
          to cancel.
        </div>
      ) : null}

      <div className="flex shrink-0 gap-1 border-b border-gray-200 bg-gray-50 px-2 py-2">
        {tabs.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex-1 px-2 py-1.5 font-display text-[0.65rem] font-bold tracking-wide uppercase ${
                active
                  ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-200"
                  : "text-gray-500 hover:bg-white/70 hover:text-gray-800"
              }`}
            >
              {item.label} ({item.count})
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "PENDING" ? (
          pending.length === 0 ? (
            <p className="px-4 py-8 text-sm text-gray-500">
              No pending rooms. Accepted and rejected items stay available in
              the other tabs.
            </p>
          ) : (
            <ul className="divide-y divide-gray-200">
              {pending.map((suggestion, index) => {
                const draft = drafts[suggestion.id] ?? toDraft(suggestion);
                const a = parseOptional(draft.dimensionA);
                const b = parseOptional(draft.dimensionB);
                const area = parseOptional(draft.calculatedArea);
                const peri = parseOptional(draft.calculatedPerimeter);
                const busy = busyId === suggestion.id;
                const placing = placingSuggestionId === suggestion.id;
                const acceptBlocked =
                  placingSuggestionId != null &&
                  placingSuggestionId !== suggestion.id;
                const rowBg = placing
                  ? "bg-cyan-50 ring-2 ring-inset ring-cyan-400"
                  : index % 2 === 0
                    ? "bg-white"
                    : "bg-gray-50";

                return (
                  <li key={suggestion.id} className={`px-4 py-3 ${rowBg}`}>
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <label className="block min-w-0 flex-1">
                        <span className="mb-1 block text-[0.65rem] font-medium tracking-wide text-gray-500 uppercase">
                          Room Name
                        </span>
                        <input
                          value={draft.label}
                          onChange={(event) =>
                            updateDraft(suggestion.id, {
                              label: event.target.value,
                            })
                          }
                          className={inputClass}
                        />
                      </label>
                      <span
                        className={`mt-5 shrink-0 border px-1.5 py-0.5 text-[0.6rem] font-semibold tracking-wide uppercase ${confidenceClass(suggestion.confidence)}`}
                      >
                        {suggestion.confidence}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="mb-1 block text-[0.65rem] font-medium tracking-wide text-gray-500 uppercase">
                          Dim A ({suggestion.dimensionUnit || "m"})
                        </span>
                        <input
                          value={draft.dimensionA}
                          onChange={(event) =>
                            updateDraft(suggestion.id, {
                              dimensionA: event.target.value,
                            })
                          }
                          className={`${inputClass} tabular-nums`}
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[0.65rem] font-medium tracking-wide text-gray-500 uppercase">
                          Dim B ({suggestion.dimensionUnit || "m"})
                        </span>
                        <input
                          value={draft.dimensionB}
                          onChange={(event) =>
                            updateDraft(suggestion.id, {
                              dimensionB: event.target.value,
                            })
                          }
                          className={`${inputClass} tabular-nums`}
                        />
                      </label>
                    </div>
                    <p className="mt-1 text-xs tabular-nums text-gray-900">
                      {formatDimensionPair(
                        a,
                        b,
                        suggestion.dimensionUnit,
                        DEFAULT_UNIT_SYSTEM
                      )}
                    </p>

                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="mb-1 block text-[0.65rem] font-medium tracking-wide text-gray-500 uppercase">
                          Area ({suggestion.dimensionUnit === "mm" ? "mm²" : "m²"})
                        </span>
                        <input
                          value={draft.calculatedArea}
                          onChange={(event) =>
                            updateDraft(suggestion.id, {
                              calculatedArea: event.target.value,
                            })
                          }
                          className={`${inputClass} tabular-nums`}
                        />
                        <span className="mt-0.5 block text-xs tabular-nums text-gray-900">
                          {area == null
                            ? "—"
                            : formatArea(
                                area,
                                DEFAULT_UNIT_SYSTEM,
                                suggestion.dimensionUnit
                              )}
                        </span>
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[0.65rem] font-medium tracking-wide text-gray-500 uppercase">
                          Perimeter ({suggestion.dimensionUnit || "m"})
                        </span>
                        <input
                          value={draft.calculatedPerimeter}
                          onChange={(event) =>
                            updateDraft(suggestion.id, {
                              calculatedPerimeter: event.target.value,
                            })
                          }
                          className={`${inputClass} tabular-nums`}
                        />
                        <span className="mt-0.5 block text-xs tabular-nums text-gray-900">
                          {peri == null
                            ? "—"
                            : formatLength(
                                peri,
                                DEFAULT_UNIT_SYSTEM,
                                suggestion.dimensionUnit
                              )}
                        </span>
                      </label>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        disabled={busyId != null || acceptBlocked || placing}
                        onClick={() =>
                          onAccept(suggestion.id, {
                            label: draft.label.trim() || suggestion.label,
                            dimensionA: a,
                            dimensionB: b,
                            calculatedArea: area,
                            calculatedPerimeter: peri,
                          })
                        }
                        className="flex-1 bg-gray-900 px-2 py-1.5 font-display text-[0.65rem] font-bold tracking-wide text-white uppercase hover:bg-blue-800 disabled:opacity-50"
                      >
                        {placing ? "Click blueprint…" : busy ? "…" : "Accept"}
                      </button>
                      <button
                        type="button"
                        disabled={busyId != null || placingSuggestionId != null}
                        onClick={() => onReject(suggestion.id)}
                        className="flex-1 border border-gray-300 bg-white px-2 py-1.5 font-display text-[0.65rem] font-semibold tracking-wide text-gray-700 uppercase hover:border-red-400 hover:text-red-700 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )
        ) : null}

        {tab === "ACCEPTED" ? (
          accepted.length === 0 ? (
            <p className="px-4 py-8 text-sm text-gray-500">
              No accepted rooms yet.
            </p>
          ) : (
            <ul className="divide-y divide-gray-200">
              {accepted.map((suggestion, index) => {
                const rowBg = index % 2 === 0 ? "bg-white" : "bg-gray-50";
                return (
                  <li key={suggestion.id} className={`px-4 py-3 ${rowBg}`}>
                    <p className="text-sm font-medium text-gray-900">
                      {suggestion.label}
                    </p>
                    <p className="mt-1 text-xs tabular-nums text-gray-900">
                      Area{" "}
                      {suggestion.calculatedArea == null
                        ? "—"
                        : formatArea(
                            suggestion.calculatedArea,
                            DEFAULT_UNIT_SYSTEM,
                            suggestion.dimensionUnit
                          )}
                      {" · "}
                      Peri{" "}
                      {suggestion.calculatedPerimeter == null
                        ? "—"
                        : formatLength(
                            suggestion.calculatedPerimeter,
                            DEFAULT_UNIT_SYSTEM,
                            suggestion.dimensionUnit
                          )}
                    </p>
                    {suggestion.takeoffItemId ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            onFocusTakeoffItem(suggestion.takeoffItemId!)
                          }
                          className="text-xs font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900"
                        >
                          Show in takeoff list →
                        </button>
                        {suggestion.promotedInstanceId ? (
                          <span className="border border-emerald-300 bg-emerald-50 px-2 py-1 text-[0.65rem] font-semibold tracking-wide text-emerald-800 uppercase">
                            Promoted
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onPromote(suggestion)}
                            className="border border-blue-300 bg-blue-50 px-2 py-1 text-[0.65rem] font-semibold tracking-wide text-blue-800 uppercase hover:bg-blue-100"
                          >
                            Promote to Element
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-gray-500">
                        No linked takeoff item
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )
        ) : null}

        {tab === "REJECTED" ? (
          rejected.length === 0 ? (
            <p className="px-4 py-8 text-sm text-gray-500">
              No rejected rooms.
            </p>
          ) : (
            <ul className="divide-y divide-gray-200">
              {rejected.map((suggestion, index) => {
                const rowBg = index % 2 === 0 ? "bg-white" : "bg-gray-50";
                const busy = busyId === suggestion.id;
                return (
                  <li key={suggestion.id} className={`px-4 py-3 ${rowBg}`}>
                    <p className="text-sm font-medium text-gray-900">
                      {suggestion.label}
                    </p>
                    <p className="mt-1 text-xs tabular-nums text-gray-900">
                      Area{" "}
                      {suggestion.calculatedArea == null
                        ? "—"
                        : formatArea(
                            suggestion.calculatedArea,
                            DEFAULT_UNIT_SYSTEM,
                            suggestion.dimensionUnit
                          )}
                      {" · "}
                      Peri{" "}
                      {suggestion.calculatedPerimeter == null
                        ? "—"
                        : formatLength(
                            suggestion.calculatedPerimeter,
                            DEFAULT_UNIT_SYSTEM,
                            suggestion.dimensionUnit
                          )}
                    </p>
                    <button
                      type="button"
                      disabled={busyId != null}
                      onClick={() => onRestore(suggestion.id)}
                      className="mt-2 border border-gray-300 bg-white px-2 py-1 font-display text-[0.65rem] font-semibold tracking-wide text-gray-800 uppercase hover:bg-gray-50 disabled:opacity-50"
                    >
                      {busy ? "…" : "Restore to Pending"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )
        ) : null}
      </div>
    </div>
  );
}
