import { describe, expect, test } from 'vitest';
import { entrySchema, applicationSchema, essaySchema } from '../src/lib/schema';
import { TYPE_LABELS, TYPE_ORDER } from '../src/lib/types';

test('기본값 채움', () => {
  const e = entrySchema.parse({ type: 'award', title: '해커톤 2등', date: '2026-05-01', summary: '드론 경로 최적화로 2등' });
  expect(e.public).toBe(true);
  expect(e.featured).toBe(false);
  expect(e.tags).toEqual([]);
});

test('모르는 종류 거부', () => {
  expect(() => entrySchema.parse({ type: 'hobby', title: 'x', date: '2026-01-01', summary: 'x' })).toThrow();
});

test('summary 80자 초과 거부', () => {
  expect(() => entrySchema.parse({ type: 'etc', title: 'x', date: '2026-01-01', summary: '가'.repeat(81) })).toThrow();
});

describe('종류', () => {
  test('라벨과 이력서 순서', () => {
    expect(TYPE_ORDER).toEqual(['education', 'career', 'project', 'research', 'award', 'activity', 'certificate', 'etc']);
    expect(TYPE_LABELS.activity).toBe('대외활동/동아리');
    expect(Object.keys(TYPE_LABELS).sort()).toEqual([...TYPE_ORDER].sort());
  });
});

describe('지원 건·자소서', () => {
  test('score는 0~100', () => {
    const base = { company: 'A', position: 'B', created: '2026-11-21', requirements: [], gaps: [] };
    expect(() => applicationSchema.parse({ ...base, matches: [{ entry: 'x', score: 101, reason: 'r' }] })).toThrow();
    expect(applicationSchema.parse({ ...base, matches: [{ entry: 'x', score: 70, reason: 'r' }] }).created).toBeInstanceOf(Date);
  });
  test('자소서 entries 기본값', () => {
    expect(essaySchema.parse({ question: 'q' }).entries).toEqual([]);
  });
});
