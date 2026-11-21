import { expect, test } from 'vitest';
import { archiveStats } from '../src/lib/stats';
import type { EntryType } from '../src/lib/types';

const e = (id: string, type: EntryType, date: string, pub = true) => ({
  id,
  data: { type, date: new Date(date), public: pub, featured: false },
});

test('비공개는 통계에서 빠짐', () => {
  const s = archiveStats([e('a', 'project', '2026-11-01'), e('b', 'award', '2026-11-10', false)], new Date('2026-11-21'));
  expect(s).toEqual({ total: 1, projects: 1, awards: 0, daysSinceLast: 20 });
});

test('항목 없으면 daysSinceLast null', () => {
  expect(archiveStats([], new Date()).daysSinceLast).toBeNull();
});

test('비공개만 있으면 전부 0, daysSinceLast null', () => {
  expect(archiveStats([e('x', 'award', '2026-11-20', false)], new Date('2026-11-21'))).toEqual({
    total: 0,
    projects: 0,
    awards: 0,
    daysSinceLast: null,
  });
});

test('같은 날이면 0, 미래 날짜는 0으로', () => {
  const now = new Date('2026-11-21T15:00:00Z');
  expect(archiveStats([e('a', 'etc', '2026-11-21')], now).daysSinceLast).toBe(0);
  expect(archiveStats([e('a', 'etc', '2026-12-01')], now).daysSinceLast).toBe(0);
});
