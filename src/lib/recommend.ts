import type { EntryLike } from './entries';

/**
 * 추천 근거 id를 실제 공개 항목으로 바꾼다.
 * ids 순서를 지키고, 없는 id나 비공개 항목은 뺀다.
 */
export function resolveFrom<T extends EntryLike>(ids: string[], entries: T[]): T[] {
  const byId = new Map(entries.map((e) => [e.id, e]));
  return ids.map((id) => byId.get(id)).filter((e): e is T => !!e && e.data.public);
}

export type RecruitStatus = '모집 중' | '모집 예정' | '마감' | '모집 정보 확인 필요';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** 실제로 있는 날짜의 YYYY-MM-DD면 그대로, 아니면 undefined (2026-02-30 같은 값도 거부) */
function day(value: string | undefined): string | undefined {
  if (!value || !DAY.test(value)) return undefined;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value ? value : undefined;
}

/** Asia/Seoul 기준 오늘 날짜 YYYY-MM-DD */
export function seoulDay(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/**
 * 인턴 모집 상태. 적합도와 따로 보여준다.
 * 공고 링크나 읽을 수 있는 마감일이 없으면(시작일이 있는데 읽을 수 없어도) '모집 정보 확인 필요'.
 * 마감일 당일까지는 '모집 중'이다. 날짜는 서울 기준으로 비교한다.
 */
export function recruitStatus(x: { start?: string; deadline?: string; url?: string }, today: Date): RecruitStatus {
  const deadline = day(x.deadline);
  const start = day(x.start);
  if (!x.url?.trim() || !deadline || (x.start && !start)) return '모집 정보 확인 필요';

  const now = seoulDay(today);
  if (now > deadline) return '마감';
  if (start && now < start) return '모집 예정';
  return '모집 중';
}
