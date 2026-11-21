import { publicOnly, type EntryLike } from './entries';

const DAY_MS = 24 * 60 * 60 * 1000;

export type ArchiveStats = {
  total: number;
  projects: number;
  awards: number;
  /** 마지막(가장 최근) 기록 이후 지난 날 수. 공개 항목이 없으면 null, 미래 날짜면 0. */
  daysSinceLast: number | null;
};

/** last(ms)부터 now까지 지난 날 수. 미래면 0. 빌드 때와 브라우저에서 같은 식을 쓴다. */
export function daysSince(last: number, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - last) / DAY_MS));
}

/** 0이면 "오늘", 아니면 "N일 전" */
export function lastLabel(days: number): string {
  return days === 0 ? '오늘' : `${days}일 전`;
}

/** 히어로 통계 줄. 비공개 항목은 여기서 직접 걸러서 숫자에 섞이지 않게 한다. */
export function archiveStats(xs: EntryLike[], now: Date): ArchiveStats {
  const pub = publicOnly(xs);
  const last = pub.reduce<number | null>((max, x) => {
    const t = x.data.date.getTime();
    return max === null || t > max ? t : max;
  }, null);
  return {
    total: pub.length,
    projects: pub.filter((x) => x.data.type === 'project').length,
    awards: pub.filter((x) => x.data.type === 'award').length,
    daysSinceLast: last === null ? null : daysSince(last, now),
  };
}
