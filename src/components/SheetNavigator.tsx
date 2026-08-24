import { useMemo, useState, type DragEvent } from "react";
import { Link } from "react-router-dom";
import { resolveMediaUrl } from "../lib/api";
import type { Sheet } from "../types/models";

const SUGGESTED_DISCIPLINES = [
  "Architectural",
  "Electrical",
  "Plumbing",
  "Structural",
  "Other",
] as const;

const OTHER_PAGES_KEY = "Other Pages";

interface SheetNavigatorProps {
  projectId: string;
  sheets: Sheet[];
  onRename: (sheetId: string, name: string) => void;
  onDisciplineChange: (sheetId: string, discipline: string) => void;
  onReorder: (orderedIds: string[]) => void;
}

function thumbUrl(sheet: Sheet): string {
  return resolveMediaUrl(sheet.thumbnailFileUrl || sheet.originalFileUrl);
}

function isExtracting(sheet: Sheet): boolean {
  return (
    sheet.aiExtractionStatus === "pending" ||
    sheet.aiExtractionStatus === "processing"
  );
}

function SheetRow({
  projectId,
  sheet,
  dragId,
  editingId,
  editName,
  customDisciplineFor,
  customDisciplineValue,
  existingDisciplines,
  onDragStart,
  onDropOn,
  beginRename,
  commitRename,
  setEditingId,
  setEditName,
  handleDisciplineSelect,
  commitCustomDiscipline,
  setCustomDisciplineValue,
}: {
  projectId: string;
  sheet: Sheet;
  dragId: string | null;
  editingId: string | null;
  editName: string;
  customDisciplineFor: string | null;
  customDisciplineValue: string;
  existingDisciplines: string[];
  onDragStart: (sheetId: string) => void;
  onDropOn: (targetId: string) => void;
  beginRename: (sheet: Sheet) => void;
  commitRename: (sheetId: string) => void;
  setEditingId: (id: string | null) => void;
  setEditName: (value: string) => void;
  handleDisciplineSelect: (sheetId: string, value: string) => void;
  commitCustomDiscipline: (sheetId: string) => void;
  setCustomDisciplineValue: (value: string) => void;
}) {
  const extracting = isExtracting(sheet);
  const title = sheet.pageTitle?.trim() || sheet.name;

  return (
    <li
      draggable={!extracting}
      onDragStart={() => {
        if (!extracting) onDragStart(sheet.id);
      }}
      onDragOver={(event: DragEvent) => event.preventDefault()}
      onDrop={() => {
        if (!extracting) onDropOn(sheet.id);
      }}
      className={`flex gap-3 px-3 py-3 transition ${
        dragId === sheet.id ? "bg-blueprint/5 opacity-70" : ""
      } ${extracting ? "bg-blueprint/5" : ""}`}
      aria-busy={extracting || undefined}
    >
      {extracting ? (
        <div className="relative h-16 w-24 shrink-0 overflow-hidden border border-blueprint/35 bg-ink/5">
          <img
            src={thumbUrl(sheet)}
            alt=""
            className="h-full w-full object-cover object-top opacity-45 saturate-50"
            loading="lazy"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-ink/25">
            <span
              className="h-7 w-7 rounded-full border-2 border-white/25 border-t-accent"
              style={{ animation: "spin 0.9s linear infinite" }}
              aria-hidden
            />
          </div>
        </div>
      ) : (
        <Link
          to={`/projects/${projectId}/sheets/${sheet.id}`}
          className="block h-16 w-24 shrink-0 overflow-hidden border border-line bg-ink/5"
        >
          <img
            src={thumbUrl(sheet)}
            alt=""
            className="h-full w-full object-cover object-top"
            loading="lazy"
          />
        </Link>
      )}

      <div className="min-w-0 flex-1">
        {editingId === sheet.id ? (
          <input
            autoFocus
            value={editName}
            onChange={(event) => setEditName(event.target.value)}
            onBlur={() => commitRename(sheet.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitRename(sheet.id);
              }
              if (event.key === "Escape") {
                setEditingId(null);
              }
            }}
            className="w-full border border-blueprint px-2 py-1 text-sm outline-none"
          />
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {extracting ? (
              <span className="truncate font-display text-sm font-bold text-ink/70">
                {title}
              </span>
            ) : (
              <Link
                to={`/projects/${projectId}/sheets/${sheet.id}`}
                className="truncate font-display text-sm font-bold text-ink hover:text-blueprint"
              >
                {title}
              </Link>
            )}
            {extracting ? (
              <span className="ai-extracting-badge inline-flex items-center gap-2 border border-blueprint/35 px-2.5 py-1 font-display text-[0.65rem] font-bold tracking-wide text-ink-soft uppercase">
                <span className="inline-flex items-center gap-0.5" aria-hidden>
                  <span className="ai-extracting-dot h-1.5 w-1.5 rounded-full bg-blueprint" />
                  <span className="ai-extracting-dot h-1.5 w-1.5 rounded-full bg-blueprint" />
                  <span className="ai-extracting-dot h-1.5 w-1.5 rounded-full bg-blueprint" />
                </span>
                AI Extracting details
              </span>
            ) : null}
            {sheet.aiExtractionStatus === "failed" ? (
              <span
                className="border border-danger/30 bg-danger/5 px-1.5 py-0.5 text-[0.65rem] font-semibold tracking-wide text-danger uppercase"
                title={sheet.aiExtractionError ?? "Extraction failed"}
              >
                AI failed
              </span>
            ) : null}
            {!extracting ? (
              <button
                type="button"
                onClick={() => beginRename(sheet)}
                className="text-[0.65rem] text-ink-soft/50 uppercase hover:text-blueprint"
              >
                Rename
              </button>
            ) : null}
          </div>
        )}

        <p className="mt-0.5 text-[0.7rem] text-ink-soft/65">
          Page {sheet.pageNumber}
          {" · "}
          {extracting
            ? "Locked until AI finishes"
            : sheet.calibrationScale == null
              ? "Not calibrated"
              : `Calibrated (${sheet.calibrationUnit})`}
          {!extracting ? " · Drag to reorder" : null}
        </p>

        {!extracting ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1 text-[0.65rem] text-ink-soft">
              Discipline
              <select
                value={
                  customDisciplineFor === sheet.id
                    ? "__custom__"
                    : sheet.discipline || "Other"
                }
                onChange={(event) =>
                  handleDisciplineSelect(sheet.id, event.target.value)
                }
                className="border border-line-strong/40 bg-bg px-1.5 py-0.5 text-[0.7rem] text-ink outline-none focus:border-blueprint"
              >
                {existingDisciplines.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
                <option value="__custom__">Custom…</option>
              </select>
            </label>
            {customDisciplineFor === sheet.id ? (
              <input
                autoFocus
                value={customDisciplineValue}
                onChange={(event) =>
                  setCustomDisciplineValue(event.target.value)
                }
                onBlur={() => commitCustomDiscipline(sheet.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitCustomDiscipline(sheet.id);
                  }
                }}
                placeholder="New discipline"
                className="border border-blueprint px-1.5 py-0.5 text-[0.7rem] outline-none"
              />
            ) : null}
          </div>
        ) : (
          <p className="mt-1.5 text-[0.7rem] leading-relaxed text-blueprint/80">
            Reading rooms and dimensions from this sheet…
          </p>
        )}
      </div>

      {extracting ? (
        <span
          className="shrink-0 self-center font-display text-[0.65rem] font-bold tracking-wide text-ink-soft/35 uppercase"
          title="Available when AI extraction finishes"
        >
          Pending
        </span>
      ) : (
        <Link
          to={`/projects/${projectId}/sheets/${sheet.id}`}
          className="shrink-0 self-center font-display text-[0.65rem] font-bold tracking-wide text-accent-deep uppercase"
        >
          Open →
        </Link>
      )}
    </li>
  );
}

export function SheetNavigator({
  projectId,
  sheets,
  onRename,
  onDisciplineChange,
  onReorder,
}: SheetNavigatorProps) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    [OTHER_PAGES_KEY]: true,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [customDisciplineFor, setCustomDisciplineFor] = useState<string | null>(
    null
  );
  const [customDisciplineValue, setCustomDisciplineValue] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);

  const existingDisciplines = useMemo(() => {
    const set = new Set<string>();
    for (const sheet of sheets) {
      set.add(sheet.discipline || "Other");
    }
    for (const suggested of SUGGESTED_DISCIPLINES) {
      set.add(suggested);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [sheets]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return sheets;
    }
    return sheets.filter((sheet) => {
      const name = (sheet.pageTitle || sheet.name).toLowerCase();
      const discipline = (sheet.discipline || "Other").toLowerCase();
      return name.includes(q) || discipline.includes(q);
    });
  }, [sheets, query]);

  const { floorPlanGroups, otherPages } = useMemo(() => {
    const floorPlans: Sheet[] = [];
    const others: Sheet[] = [];
    for (const sheet of filtered) {
      if (sheet.isFloorPlan === false) {
        others.push(sheet);
      } else {
        // true, or null (still extracting / unclassified) → main list
        floorPlans.push(sheet);
      }
    }

    const map = new Map<string, Sheet[]>();
    for (const sheet of floorPlans) {
      const key = sheet.discipline || "Other";
      const list = map.get(key) ?? [];
      list.push(sheet);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) => a.sortOrder - b.sortOrder || a.pageNumber - b.pageNumber
      );
    }
    others.sort(
      (a, b) => a.sortOrder - b.sortOrder || a.pageNumber - b.pageNumber
    );

    return {
      floorPlanGroups: [...map.entries()].sort(([a], [b]) =>
        a.localeCompare(b)
      ),
      otherPages: others,
    };
  }, [filtered]);

  function toggleSection(key: string): void {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function beginRename(sheet: Sheet): void {
    setEditingId(sheet.id);
    setEditName(sheet.name);
  }

  function commitRename(sheetId: string): void {
    const next = editName.trim();
    setEditingId(null);
    if (!next) {
      return;
    }
    const sheet = sheets.find((row) => row.id === sheetId);
    if (sheet && sheet.name !== next) {
      onRename(sheetId, next);
    }
  }

  function handleDisciplineSelect(sheetId: string, value: string): void {
    if (value === "__custom__") {
      setCustomDisciplineFor(sheetId);
      setCustomDisciplineValue("");
      return;
    }
    setCustomDisciplineFor(null);
    onDisciplineChange(sheetId, value);
  }

  function commitCustomDiscipline(sheetId: string): void {
    const next = customDisciplineValue.trim();
    setCustomDisciplineFor(null);
    if (next) {
      onDisciplineChange(sheetId, next);
    }
  }

  function onDragStart(sheetId: string): void {
    setDragId(sheetId);
  }

  function onDropOn(targetId: string): void {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      return;
    }

    const ordered = [...sheets]
      .sort((a, b) => a.sortOrder - b.sortOrder || a.pageNumber - b.pageNumber)
      .map((sheet) => sheet.id);

    const from = ordered.indexOf(dragId);
    const to = ordered.indexOf(targetId);
    if (from < 0 || to < 0) {
      setDragId(null);
      return;
    }

    ordered.splice(from, 1);
    ordered.splice(to, 0, dragId);
    setDragId(null);
    onReorder(ordered);
  }

  const rowProps = {
    projectId,
    dragId,
    editingId,
    editName,
    customDisciplineFor,
    customDisciplineValue,
    existingDisciplines,
    onDragStart,
    onDropOn,
    beginRename,
    commitRename,
    setEditingId,
    setEditName,
    handleDisciplineSelect,
    commitCustomDiscipline,
    setCustomDisciplineValue,
  };

  if (sheets.length === 0) {
    return (
      <div className="border border-dashed border-line-strong/60 bg-paper-bright/60 px-6 py-14 text-center">
        <p className="font-display text-lg font-semibold text-ink">
          No sheets yet
        </p>
        <p className="mt-2 text-sm text-ink-soft/75">
          Upload one or more PDFs to convert plan pages into takeoff sheets.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex min-w-[14rem] flex-1 items-center gap-2 text-xs text-ink-soft">
          Search
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Sheet name or discipline…"
            className="min-w-0 flex-1 border border-line-strong/40 bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-blueprint"
          />
        </label>
        <span className="text-xs tracking-wide text-ink-soft/60 uppercase">
          {filtered.length} of {sheets.length}
        </span>
      </div>

      <div className="space-y-4">
        {floorPlanGroups.map(([discipline, disciplineSheets]) => {
          const isCollapsed = Boolean(collapsed[discipline]);
          return (
            <section key={discipline} className="border border-line bg-panel">
              <button
                type="button"
                onClick={() => toggleSection(discipline)}
                className="flex w-full items-center gap-2 border-b border-line/70 bg-panel-hover px-4 py-2.5 text-left text-ink"
              >
                <span aria-hidden>{isCollapsed ? "▸" : "▾"}</span>
                <span className="font-display text-sm font-bold tracking-wide uppercase">
                  {discipline}
                </span>
                <span className="ml-auto text-xs text-steel">
                  {disciplineSheets.length} sheet
                  {disciplineSheets.length === 1 ? "" : "s"}
                </span>
              </button>

              {!isCollapsed ? (
                <ul className="divide-y divide-line/60">
                  {disciplineSheets.map((sheet) => (
                    <SheetRow key={sheet.id} sheet={sheet} {...rowProps} />
                  ))}
                </ul>
              ) : null}
            </section>
          );
        })}

        {otherPages.length > 0 ? (
          <section className="border border-line bg-panel">
            <button
              type="button"
              onClick={() => toggleSection(OTHER_PAGES_KEY)}
              className="flex w-full items-center gap-2 border-b border-line/70 bg-panel-hover px-4 py-2.5 text-left text-ink"
            >
              <span aria-hidden>
                {collapsed[OTHER_PAGES_KEY] ? "▸" : "▾"}
              </span>
              <span className="font-display text-sm font-bold tracking-wide uppercase">
                {OTHER_PAGES_KEY}
              </span>
              <span className="ml-auto text-xs text-steel">
                {otherPages.length} sheet
                {otherPages.length === 1 ? "" : "s"} · not floor plans
              </span>
            </button>

            {!collapsed[OTHER_PAGES_KEY] ? (
              <ul className="divide-y divide-line/60">
                {otherPages.map((sheet) => (
                  <SheetRow key={sheet.id} sheet={sheet} {...rowProps} />
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}
