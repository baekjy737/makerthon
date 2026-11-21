import { describe, expect, test } from 'vitest';
import { recruitStatus, resolveFrom } from '../src/lib/recommend';

const pub = (id: string) => ({ id, data: { type: 'paper' as const, date: new Date('2026-01-01'), public: true, featured: false } });
const priv = (id: string) => ({ id, data: { ...pub(id).data, public: false } });

test('resolveFrom: 없는 ID·비공개 제외, 순서 유지', () => {
  expect(resolveFrom(['x', 'b', 'a'], [pub('a'), priv('b')]).map((x) => x.id)).toEqual(['a']);
  expect(resolveFrom(['c', 'a'], [pub('a'), pub('c')]).map((x) => x.id)).toEqual(['c', 'a']);
  expect(resolveFrom([], [pub('a')])).toEqual([]);
});

describe('recruitStatus', () => {
  test('마감일 당일은 모집 중', () => {
    expect(recruitStatus({ deadline: '2026-11-21', url: 'https://x' }, new Date('2026-11-21T23:00:00+09:00'))).toBe('모집 중');
  });

  test('지난 마감·시작 전·정보 없음', () => {
    const now = new Date('2026-11-21T12:00:00+09:00');
    expect(recruitStatus({ deadline: '2026-11-20', url: 'https://x' }, now)).toBe('마감');
    expect(recruitStatus({ start: '2026-12-01', deadline: '2026-12-10', url: 'https://x' }, now)).toBe('모집 예정');
    expect(recruitStatus({ deadline: '2026-12-10' }, now)).toBe('모집 정보 확인 필요');
    expect(recruitStatus({ deadline: '곧', url: 'https://x' }, now)).toBe('모집 정보 확인 필요');
  });

  test('UTC로는 전날이어도 서울 날짜로 비교', () => {
    // 2026-11-21 00:30 KST = 2026-11-20 15:30 UTC. 서울 기준 오늘은 11-21이라 11-20 마감은 지났다
    expect(recruitStatus({ deadline: '2026-11-20', url: 'https://x' }, new Date('2026-11-20T15:30:00Z'))).toBe('마감');
  });

  test('시작일 당일은 모집 중, 마감 없음·없는 날짜·빈 링크는 확인 필요', () => {
    const now = new Date('2026-12-01T09:00:00+09:00');
    expect(recruitStatus({ start: '2026-12-01', deadline: '2026-12-10', url: 'https://x' }, now)).toBe('모집 중');
    expect(recruitStatus({ start: '2026-12-01', url: 'https://x' }, now)).toBe('모집 정보 확인 필요');
    expect(recruitStatus({ deadline: '2026-02-30', url: 'https://x' }, now)).toBe('모집 정보 확인 필요');
    expect(recruitStatus({ start: '언젠가', deadline: '2026-12-10', url: 'https://x' }, now)).toBe('모집 정보 확인 필요');
    expect(recruitStatus({ deadline: '2026-12-10', url: '' }, now)).toBe('모집 정보 확인 필요');
  });
});
