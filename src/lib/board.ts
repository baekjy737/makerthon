import { OPENING_KINDS, OPENING_LABELS, openingStatus, type Opening, type OpeningKind, type OpeningStatus } from './openings';
import { seoulDay } from './recommend';

const DAY_MS = 24 * 60 * 60 * 1000;

/** 마감일까지 남은 날 수. 서울 날짜 기준이고 당일은 0, 지났으면 음수 */
export function daysLeft(deadline: Date, now: Date): number {
  const today = Date.parse(`${seoulDay(now)}T00:00:00Z`);
  const due = Date.parse(`${deadline.toISOString().slice(0, 10)}T00:00:00Z`);
  return Math.round((due - today) / DAY_MS);
}

/** 0이면 D-day, 양수면 D-n, 지났으면 표시하지 않음(null) */
export function ddayLabel(days: number): string | null {
  if (days < 0) return null;
  return days === 0 ? 'D-day' : `D-${days}`;
}

export type BoardItem = { opening: Opening; status: OpeningStatus };

export type BoardGroup = {
  kind: OpeningKind;
  label: string;
  /** 모집 중 → 확인 필요. 각각 마감 임박순, 마감일 없는 건 뒤 */
  active: BoardItem[];
  /** 마감. 최근에 마감된 것부터 */
  closed: BoardItem[];
  openCount: number;
};

const RANK: Record<OpeningStatus, number> = { open: 0, unverified: 1, closed: 2 };
const time = (d?: Date) => d?.getTime() ?? Number.POSITIVE_INFINITY;

/** APPLY 모집 공고 보드: 유형 4개(OPENING_KINDS 순서)로 나누고 상태·마감일 순으로 정렬한다 */
export function boardGroups(openings: Opening[], now: Date): BoardGroup[] {
  const items = openings.map((opening) => ({ opening, status: openingStatus(opening, now) }));
  return OPENING_KINDS.map((kind) => {
    const mine = items.filter((x) => x.opening.kind === kind);
    const active = mine
      .filter((x) => x.status !== 'closed')
      .sort((a, b) => RANK[a.status] - RANK[b.status] || time(a.opening.deadline) - time(b.opening.deadline));
    const closed = mine
      .filter((x) => x.status === 'closed')
      .sort((a, b) => time(b.opening.deadline) - time(a.opening.deadline));
    return {
      kind,
      label: OPENING_LABELS[kind],
      active,
      closed,
      openCount: active.filter((x) => x.status === 'open').length,
    };
  });
}
