import { create } from "zustand";
import type { MarkupObject, TakeoffItem } from "../types/models";

/**
 * Undo/redo entry for takeoff + markup mutations.
 * Calibration is intentionally excluded from history.
 */
export type HistoryEntry =
  | { type: "takeoff_create"; item: TakeoffItem }
  | { type: "takeoff_delete"; item: TakeoffItem }
  | { type: "markup_create"; markup: MarkupObject }
  | { type: "markup_delete"; markup: MarkupObject }
  | { type: "markup_update"; before: MarkupObject; after: MarkupObject };

interface HistoryState {
  past: HistoryEntry[];
  future: HistoryEntry[];
  push: (entry: HistoryEntry) => void;
  /** Replace the most recent past entry (e.g. after recreate assigns a new id). */
  replaceLastPast: (entry: HistoryEntry) => void;
  popUndo: () => HistoryEntry | null;
  popRedo: () => HistoryEntry | null;
  /** After undo, push that entry onto future (and vice versa for redo). */
  pushFuture: (entry: HistoryEntry) => void;
  pushPastFromRedo: (entry: HistoryEntry) => void;
  clear: () => void;
}

const MAX_HISTORY = 100;

export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],

  push: (entry) => {
    set((state) => ({
      past: [...state.past, entry].slice(-MAX_HISTORY),
      future: [],
    }));
  },

  replaceLastPast: (entry) => {
    set((state) => {
      if (state.past.length === 0) {
        return state;
      }
      const past = state.past.slice(0, -1);
      past.push(entry);
      return { past };
    });
  },

  popUndo: () => {
    const { past } = get();
    if (past.length === 0) {
      return null;
    }
    const entry = past[past.length - 1];
    set({ past: past.slice(0, -1) });
    return entry;
  },

  popRedo: () => {
    const { future } = get();
    if (future.length === 0) {
      return null;
    }
    const entry = future[future.length - 1];
    set({ future: future.slice(0, -1) });
    return entry;
  },

  pushFuture: (entry) => {
    set((state) => ({
      future: [...state.future, entry].slice(-MAX_HISTORY),
    }));
  },

  pushPastFromRedo: (entry) => {
    set((state) => ({
      past: [...state.past, entry].slice(-MAX_HISTORY),
    }));
  },

  clear: () => set({ past: [], future: [] }),
}));

export function selectCanUndo(state: HistoryState): boolean {
  return state.past.length > 0;
}

export function selectCanRedo(state: HistoryState): boolean {
  return state.future.length > 0;
}
