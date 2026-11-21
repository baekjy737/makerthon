import { expect, test } from 'vitest';
import type { EntryLike } from '../src/lib/entries';
import { tailoredEntries } from '../src/lib/resume';

const entry = (id: string, isPublic = true): EntryLike => ({
  id,
  data: { type: 'project', date: new Date('2026-01-01'), public: isPublic, featured: false },
});

test('맞춤 이력서는 비공개·없는 ID를 제외하고 점수순으로 정렬한다', () => {
  const all = [entry('a'), entry('b', false), entry('c'), entry('d')];
  const matches = [
    { entry: 'c', score: 60 },
    { entry: 'b', score: 99 },
    { entry: 'missing', score: 90 },
    { entry: 'a', score: 80 },
  ];

  expect(tailoredEntries(all, matches)).toEqual([all[0], all[2]]);
  expect(matches.map((match) => match.entry)).toEqual(['c', 'b', 'missing', 'a']);
});

test('중복 ID는 최고 점수로 한 번만 선택하고 동점은 입력 순서를 따른다', () => {
  const all = [entry('a'), entry('b'), entry('c')];
  const matches = [
    { entry: 'a', score: 30 },
    { entry: 'b', score: 80 },
    { entry: 'a', score: 80 },
    { entry: 'c', score: 50 },
  ];

  expect(tailoredEntries(all, matches).map((item) => item.id)).toEqual(['b', 'a', 'c']);
});
