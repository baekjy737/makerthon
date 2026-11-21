import { expect, test } from 'vitest';
import { groupByType, publicOnly, sortByDate } from '../src/lib/entries';
import type { EntryType } from '../src/lib/types';

const e = (id: string, type: EntryType, date: string, pub = true) => ({
  id,
  data: { type, date: new Date(date), public: pub, featured: false },
});

test('publicOnly는 비공개 항목을 뺌', () => {
  const xs = [e('a', 'project', '2026-01-01'), e('b', 'award', '2026-02-01', false)];
  expect(publicOnly(xs).map((x) => x.id)).toEqual(['a']);
});

test('sortByDate는 최신순, 원본 배열 불변', () => {
  const xs = [e('old', 'etc', '2024-01-01'), e('new', 'etc', '2026-01-01'), e('mid', 'etc', '2025-01-01')];
  const before = xs.map((x) => x.id);
  expect(sortByDate(xs).map((x) => x.id)).toEqual(['new', 'mid', 'old']);
  expect(xs.map((x) => x.id)).toEqual(before);
});

test('groupByType은 이력서 순서, 빈 그룹 없음', () => {
  const g = groupByType([e('a', 'award', '2026-01-01'), e('b', 'education', '2020-03-01')]);
  expect(g.map((x) => x.type)).toEqual(['education', 'award']);
  expect(g[0].label).toBe('학력');
  expect(g[1].items.map((x) => x.id)).toEqual(['a']);
});

test('groupByType 그룹 안은 최신순', () => {
  const g = groupByType([e('p1', 'project', '2025-01-01'), e('p2', 'project', '2026-01-01')]);
  expect(g[0].items.map((x) => x.id)).toEqual(['p2', 'p1']);
});

test('groupByType(이력서)은 공부 기록을 뺀다', () => {
  const g = groupByType([e('a', 'course', '2026-03-01'), e('p', 'paper', '2026-10-01'), e('b', 'project', '2026-01-01')]);
  expect(g.map((x) => x.type)).toEqual(['project']);
});
