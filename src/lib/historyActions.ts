import {
  createMarkup,
  deleteMarkup,
  updateMarkup,
  type CreateMarkupInput,
} from "../api/markupObjects";
import {
  createTakeoffItem,
  deleteTakeoffItem,
} from "../api/takeoffItems";
import type { MarkupGeometry } from "./markupGeometry";
import type { HistoryEntry } from "../store/historyStore";
import type { MarkupObject, TakeoffItem } from "../types/models";

export interface HistorySyncHandlers {
  onTakeoffCreated: (item: TakeoffItem) => void;
  onTakeoffDeleted: (id: string) => void;
  onMarkupCreated: (markup: MarkupObject) => void;
  onMarkupDeleted: (id: string) => void;
  onMarkupUpdated: (markup: MarkupObject) => void;
}

function markupToCreateInput(markup: MarkupObject): CreateMarkupInput {
  return {
    type: markup.type,
    data: markup.data as unknown as MarkupGeometry,
    color: markup.color,
    strokeWidth: markup.strokeWidth,
    textContent: markup.textContent,
    layerId: markup.layerId,
  };
}

/**
 * Apply an undo: reverse the entry locally via handlers AND sync backend.
 * Returns the entry to place on the redo stack (possibly with refreshed ids).
 */
export async function applyUndo(
  sheetId: string,
  entry: HistoryEntry,
  handlers: HistorySyncHandlers
): Promise<HistoryEntry> {
  switch (entry.type) {
    case "takeoff_create": {
      await deleteTakeoffItem(sheetId, entry.item.id);
      handlers.onTakeoffDeleted(entry.item.id);
      return entry;
    }
    case "takeoff_delete": {
      if (!entry.item.points || entry.item.points.length === 0) {
        return entry;
      }
      const restored = await createTakeoffItem(sheetId, {
        type: entry.item.type,
        points: entry.item.points,
        color: entry.item.color,
        label: entry.item.label ?? undefined,
        layerId: entry.item.layerId,
        conditionId: entry.item.conditionId,
      });
      handlers.onTakeoffCreated(restored);
      return { type: "takeoff_delete", item: restored };
    }
    case "markup_create": {
      await deleteMarkup(sheetId, entry.markup.id);
      handlers.onMarkupDeleted(entry.markup.id);
      return entry;
    }
    case "markup_delete": {
      const restored = await createMarkup(
        sheetId,
        markupToCreateInput(entry.markup)
      );
      handlers.onMarkupCreated(restored);
      return { type: "markup_delete", markup: restored };
    }
    case "markup_update": {
      const reverted = await updateMarkup(sheetId, entry.after.id, {
        data: entry.before.data as unknown as MarkupGeometry,
        textContent: entry.before.textContent,
        color: entry.before.color,
        strokeWidth: entry.before.strokeWidth,
        type: entry.before.type,
      });
      handlers.onMarkupUpdated(reverted);
      return {
        type: "markup_update",
        before: reverted,
        after: { ...entry.after, id: reverted.id },
      };
    }
    default: {
      const _exhaustive: never = entry;
      return _exhaustive;
    }
  }
}

/**
 * Apply a redo: re-apply the entry and sync backend.
 */
export async function applyRedo(
  sheetId: string,
  entry: HistoryEntry,
  handlers: HistorySyncHandlers
): Promise<HistoryEntry> {
  switch (entry.type) {
    case "takeoff_create": {
      if (!entry.item.points || entry.item.points.length === 0) {
        return entry;
      }
      const created = await createTakeoffItem(sheetId, {
        type: entry.item.type,
        points: entry.item.points,
        color: entry.item.color,
        label: entry.item.label ?? undefined,
        layerId: entry.item.layerId,
        conditionId: entry.item.conditionId,
      });
      handlers.onTakeoffCreated(created);
      return { type: "takeoff_create", item: created };
    }
    case "takeoff_delete": {
      await deleteTakeoffItem(sheetId, entry.item.id);
      handlers.onTakeoffDeleted(entry.item.id);
      return entry;
    }
    case "markup_create": {
      const created = await createMarkup(
        sheetId,
        markupToCreateInput(entry.markup)
      );
      handlers.onMarkupCreated(created);
      return { type: "markup_create", markup: created };
    }
    case "markup_delete": {
      await deleteMarkup(sheetId, entry.markup.id);
      handlers.onMarkupDeleted(entry.markup.id);
      return entry;
    }
    case "markup_update": {
      const updated = await updateMarkup(sheetId, entry.before.id, {
        data: entry.after.data as unknown as MarkupGeometry,
        textContent: entry.after.textContent,
        color: entry.after.color,
        strokeWidth: entry.after.strokeWidth,
        type: entry.after.type,
      });
      handlers.onMarkupUpdated(updated);
      return {
        type: "markup_update",
        before: entry.before,
        after: updated,
      };
    }
    default: {
      const _exhaustive: never = entry;
      return _exhaustive;
    }
  }
}
