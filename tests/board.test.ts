import { expect, test } from 'vitest';
import { boardGroups, daysLeft, ddayLabel } from '../src/lib/board';
import type { Opening } from '../src/lib/openings';

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const op = (id: string, o: Partial<Opening> = {}): Opening => ({
  id,
  kind: 'lab-intern',
  org: 'DGIST',
  title: id,
  url: 'https://example.com',
  verified: true,
  tags: [],
  ...o,
});
// 서울 2026-11-21 정오
const NOW = new Date('2026-11-21T12:00:00+09:00');

test('daysLeft: 서울 날짜 기준, 당일 0, 지나면 음수', () => {
  expect(daysLeft(d('2026-11-21'), NOW)).toBe(0);
  expect(daysLeft(d('2026-11-28'), NOW)).toBe(7);
  expect(daysLeft(d('2026-11-20'), NOW)).toBe(-1);
  // 서울 11-22 00:30 (UTC 11-21 15:30)이면 11-22 마감은 당일
  expect(daysLeft(d('2026-11-22'), new Date('2026-11-21T15:30:00Z'))).toBe(0);
});

test('ddayLabel: D-day, D-n, 지났으면 null', () => {
  expect(ddayLabel(0)).toBe('D-day');
  expect(ddayLabel(7)).toBe('D-7');
  expect(ddayLabel(-1)).toBeNull();
});

test('boardGroups: 유형별로 나누고 모집 중 → 확인 필요 → 마감 순', () => {
  const xs = [
    op('closed-old', { deadline: d('2026-10-01') }),
    op('closed-new', { deadline: d('2026-11-10') }),
    op('unv-none', { verified: false }),
    op('unv-dated', { verified: false, deadline: d('2026-12-05') }),
    op('open-late', { deadline: d('2026-12-31') }),
    op('open-soon', { deadline: d('2026-11-25') }),
    op('intern', { kind: 'company-intern', deadline: d('2026-12-01') }),
  ];
  const g = boardGroups(xs, NOW);
  expect(g.map((x) => x.kind)).toEqual(['lab-intern', 'undergrad-research', 'company-intern', 'company-job']);
  const lab = g[0];
  expect(lab.label).toBe('대학원 연구실 인턴');
  // 모집 중·확인 필요는 마감 임박순(마감일 없는 건 뒤)
  expect(lab.active.map((x) => x.opening.id)).toEqual(['open-soon', 'open-late', 'unv-dated', 'unv-none']);
  expect(lab.active.map((x) => x.status)).toEqual(['open', 'open', 'unverified', 'unverified']);
  // 마감은 최근에 마감된 것부터
  expect(lab.closed.map((x) => x.opening.id)).toEqual(['closed-new', 'closed-old']);
  expect(lab.openCount).toBe(2);
  expect(g[1].active).toEqual([]);
  expect(g[2].active.map((x) => x.opening.id)).toEqual(['intern']);
});

test('boardGroups: 입력 배열을 바꾸지 않음', () => {
  const xs = [op('b', { deadline: d('2026-12-31') }), op('a', { deadline: d('2026-11-25') })];
  boardGroups(xs, NOW);
  expect(xs.map((x) => x.id)).toEqual(['b', 'a']);
});
