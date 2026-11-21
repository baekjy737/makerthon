import { TYPE_LABELS, TYPE_ORDER } from './types';
import type { EntryType } from './types';

type ResumeEntry = { id: string; data: { public: boolean } };
type ResumeMatch = { entry: string; score: number };

export function tailoredEntries<T extends ResumeEntry>(
  all: readonly T[],
  matches: readonly ResumeMatch[],
): T[] {
  const publicById = new Map<string, T>();
  for (const item of all) {
    if (item.data.public === true) {
      publicById.set(item.id, item);
    }
  }

  const selected: T[] = [];
  for (const match of [...matches].sort((a, b) => b.score - a.score)) {
    const item = publicById.get(match.entry);
    if (item) {
      selected.push(item);
      publicById.delete(match.entry);
    }
  }
  return selected;
}

export function resumeSections<T extends ResumeEntry & { data: { type: EntryType } }>(
  entries: readonly T[],
) {
  return TYPE_ORDER.flatMap((type) => {
    const items = entries.filter((entry) => entry.data.public === true && entry.data.type === type);
    return items.length ? [{ type, label: TYPE_LABELS[type], items }] : [];
  });
}
