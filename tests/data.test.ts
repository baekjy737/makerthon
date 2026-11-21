import { describe, expect, test } from 'vitest';
import { courses, findTarget, interns, labs } from '../src/lib/data';

describe('외부 데이터 (연구실·인턴·과목)', () => {
  test('DGIST 연구실 157곳, ID 중복 없음', () => {
    expect(labs.length).toBe(157);
    expect(new Set(labs.map((l) => l.id)).size).toBe(157);
  });

  test('샘플이 쓰는 연구실이 있다', () => {
    const found = findTarget('lab', 'DGIST_NEWBIO_003');
    expect(found?.title).toContain('기영훈');
    expect(found?.title).toBe('기영훈 교수 · 암 신호전달 및 유전체 항상성 연구실');
    expect(found?.url).toMatch(/^https?:\/\//);
  });

  test('없는 target은 undefined', () => {
    expect(findTarget('lab', 'NOPE')).toBeUndefined();
    expect(findTarget('intern', 'NOPE')).toBeUndefined();
    expect(findTarget('company', 'NOPE')).toBeUndefined();
  });

  test('lab 이름이 없는 교수는 학과명으로 표시된다', () => {
    const withoutLab = labs.find((l) => !l.lab);
    expect(withoutLab).toBeDefined();
    const found = findTarget('lab', withoutLab!.id);
    expect(found?.title).toBe(`${withoutLab!.name} 교수 · ${withoutLab!.dept}`);
  });

  test('추천 과목에서 자율적 수강 추천은 제외된다', () => {
    for (const lab of labs) {
      expect(lab.courses).not.toContain('자율적 수강 추천');
    }
  });

  test('인턴 121건, ID 중복 없음', () => {
    expect(interns.length).toBe(121);
    expect(new Set(interns.map((i) => i.id)).size).toBe(121);
  });

  test('인턴 날짜는 YYYY-MM-DD이거나 없음', () => {
    for (const i of interns) {
      for (const d of [i.start, i.deadline]) {
        if (d) expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  test('findTarget으로 인턴과 기업을 찾는다', () => {
    const first = interns[0];
    expect(findTarget('intern', first.id)).toEqual({
      title: `${first.company} ${first.title}`,
      ...(first.url ? { url: first.url } : {}),
    });
    expect(findTarget('company', first.company)).toEqual({
      title: first.company,
    });
  });

  test('과목 코드 중복 없음', () => {
    expect(courses.length).toBeGreaterThan(0);
    expect(new Set(courses.map((c) => c.code)).size).toBe(courses.length);
  });
});
