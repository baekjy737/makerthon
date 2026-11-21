import { publicOnly, type EntryLike } from './entries';

type ResumeMatch = { entry: string; score: number };

export function tailoredEntries<T extends EntryLike>(
  all: readonly T[],
  matches: readonly ResumeMatch[],
): T[] {
  const publicById = new Map(publicOnly([...all]).map((item) => [item.id, item]));

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
