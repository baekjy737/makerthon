import { describe, expect, test } from 'vitest';
import { entrySchema, applicationSchema, essaySchema, matchSchema, nextSchema } from '../src/lib/schema';
import { ENTRY_TYPES, STUDY_TYPES, TYPE_LABELS, TYPE_ORDER } from '../src/lib/types';

describe('공부 기록·추천 (Task 10)', () => {
  test('course 항목이 스키마 통과, topics 기본값 []', () => {
    const e = entrySchema.parse({ type: 'course', title: '일반생물학 I', date: '2026-03', summary: 's' });
    expect(e.topics).toEqual([]);
    expect(e.course_code).toBeUndefined();
  });

  test('새 종류 라벨, 이력서 순서에는 없음', () => {
    expect(STUDY_TYPES).toEqual(['course', 'paper', 'study']);
    expect([TYPE_LABELS.course, TYPE_LABELS.paper, TYPE_LABELS.study]).toEqual(['수강 과목', '읽은 논문', '공부자료']);
    for (const t of STUDY_TYPES) expect(TYPE_ORDER).not.toContain(t);
  });

  test('matchSchema: from이 비면 실패', () => {
    expect(() => matchSchema.parse({ kind: 'lab', target: 'X', created: '2026-11-21', score: 80, reason: 'r', from: [] })).toThrow();
  });

  test('matchSchema 기본값과 범위', () => {
    const base = { target: 'X', created: '2026-11-21', reason: 'r', from: ['a'] };
    const m = matchSchema.parse({ ...base, kind: 'intern', score: 0 });
    expect(m.check).toEqual([]);
    expect(m.sources).toEqual([]);
    expect(() => matchSchema.parse({ ...base, kind: 'school', score: 80 })).toThrow();
    expect(() => matchSchema.parse({ ...base, kind: 'lab', score: 101 })).toThrow();
    expect(() => matchSchema.parse({ ...base, kind: 'lab', score: 80, sources: [{ label: 'x', url: 'not a url' }] })).toThrow();
  });

  test('nextSchema: from·next 1개 이상, 기본값', () => {
    const base = { topic: 't', created: '2026-11-21', learned: [] };
    const n = nextSchema.parse({ ...base, from: ['a'], next: ['b'] });
    expect(n.resources).toEqual([]);
    expect(n.questions).toEqual([]);
    expect(n.created).toBeInstanceOf(Date);
    expect(() => nextSchema.parse({ ...base, from: [], next: ['b'] })).toThrow();
    expect(() => nextSchema.parse({ ...base, from: ['a'], next: [] })).toThrow();
    const r = nextSchema.parse({ ...base, from: ['a'], next: ['b'], resources: [{ label: '유전학', course: '유전학(이)' }] });
    expect(r.resources[0].url).toBeUndefined();
  });
});

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
    // 모든 종류에 라벨이 있고, 이력서 순서 + 공부 기록 = 전체 종류
    expect(Object.keys(TYPE_LABELS).sort()).toEqual([...ENTRY_TYPES].sort());
    expect([...TYPE_ORDER, ...STUDY_TYPES].sort()).toEqual([...ENTRY_TYPES].sort());
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
