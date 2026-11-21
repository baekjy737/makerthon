import { TYPE_LABELS, TYPE_ORDER, type EntryType } from './types';

/** CollectionEntry<'entries'>와 호환되는 최소 형태 */
export type EntryLike = {
  id: string;
  data: { type: EntryType; date: Date; public: boolean; featured: boolean };
};

/** `public: false` 항목을 뺀다. 사이트에 나가는 모든 목록은 이걸 거친다. */
export function publicOnly<T extends EntryLike>(xs: T[]): T[] {
  return xs.filter((x) => x.data.public);
}

/** 최신순. 원본 배열은 건드리지 않는다. */
export function sortByDate<T extends EntryLike>(xs: T[]): T[] {
  return [...xs].sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

/** TYPE_ORDER(이력서 섹션 순서)로 묶는다. 빈 그룹은 없고, 그룹 안은 최신순. */
export function groupByType<T extends EntryLike>(xs: T[]): { type: EntryType; label: string; items: T[] }[] {
  const sorted = sortByDate(xs);
  return TYPE_ORDER.map((type) => ({
    type,
    label: TYPE_LABELS[type],
    items: sorted.filter((x) => x.data.type === type),
  })).filter((g) => g.items.length > 0);
}
