import type { TakeoffItem, TakeoffType } from "../types/models";

/**
 * Next auto-incremented label for a takeoff type, e.g. "Area 1", "Area 2".
 * Skips numbers already used by items of the same type.
 */
export function nextSequentialLabel(
  prefix: string,
  items: readonly Pick<TakeoffItem, "type" | "label">[],
  type: TakeoffType
): string {
  const used = new Set<number>();
  const pattern = new RegExp(`^${escapeRegExp(prefix)}\\s+(\\d+)$`, "i");

  for (const item of items) {
    if (item.type !== type || !item.label) {
      continue;
    }
    const match = pattern.exec(item.label.trim());
    if (match) {
      used.add(Number(match[1]));
    }
  }

  let n = 1;
  while (used.has(n)) {
    n += 1;
  }
  return `${prefix} ${n}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
