import { expect, test } from 'vitest';
import { PLAN_KEY, planStore } from '../src/lib/plan';

function mem(init: Record<string, string> = {}) {
  const s = new Map(Object.entries(init));
  return {
    s,
    storage: {
      getItem: (k: string) => s.get(k) ?? null,
      setItem: (k: string, v: string) => void s.set(k, v),
      removeItem: (k: string) => void s.delete(k),
    } as unknown as Storage,
  };
}

const blocked = () =>
  ({
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    },
  }) as unknown as Storage;

test('담기·빼기', () => {
  const p = planStore(mem().storage);
  expect(p.ok).toBe(true);
  expect(p.toggle('next:a')).toBe(true);
  expect(p.has('next:a')).toBe(true);
  expect(p.toggle('next:a')).toBe(false);
  expect(p.list()).toEqual([]);
});

test('키는 plan, 값은 문자열 배열 JSON, 담은 순서 유지', () => {
  const { s, storage } = mem();
  const p = planStore(storage);
  p.toggle('next:a');
  p.toggle('match:b');
  expect(JSON.parse(s.get(PLAN_KEY)!)).toEqual(['next:a', 'match:b']);
  expect(PLAN_KEY).toBe('plan');
});

test('다른 탭에서 바뀐 값도 읽음(캐시하지 않음)', () => {
  const { s, storage } = mem();
  const p = planStore(storage);
  s.set('plan', JSON.stringify(['match:x']));
  expect(p.has('match:x')).toBe(true);
});

test('깨진 JSON은 빈 목록', () => {
  expect(planStore(mem({ plan: '{oops' }).storage).list()).toEqual([]);
});

test('배열이 아니거나 문자열이 아닌 원소는 무시', () => {
  expect(planStore(mem({ plan: '{"a":1}' }).storage).list()).toEqual([]);
  expect(planStore(mem({ plan: '["next:a", 3, null, "next:a", "match:b"]' }).storage).list()).toEqual(['next:a', 'match:b']);
});

test('깨진 값 위에 담으면 새 배열로 저장', () => {
  const { s, storage } = mem({ plan: '{oops' });
  expect(planStore(storage).toggle('next:a')).toBe(true);
  expect(s.get('plan')).toBe('["next:a"]');
});

test('차단된 storage', () => {
  const p = planStore(blocked());
  expect(p.ok).toBe(false);
  expect(p.list()).toEqual([]);
  expect(p.has('x')).toBe(false);
  expect(p.toggle('x')).toBe(false);
});

test('storage가 null이어도 죽지 않음', () => {
  const p = planStore(null);
  expect(p.ok).toBe(false);
  expect(p.toggle('x')).toBe(false);
});

test('읽기는 되고 쓰기만 막히면 ok:false', () => {
  const ro = { getItem: () => null, setItem() { throw new Error('QuotaExceededError'); } } as unknown as Storage;
  const p = planStore(ro);
  expect(p.ok).toBe(false);
  expect(p.toggle('x')).toBe(false);
});
