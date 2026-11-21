import { expect, test } from 'vitest';
import { memoStore } from '../src/lib/memo';

function mapStorage() {
  const s = new Map<string, string>();
  const storage = {
    getItem: (k: string) => s.get(k) ?? null,
    setItem: (k: string, v: string) => void s.set(k, v),
    removeItem: (k: string) => void s.delete(k),
  } as unknown as Storage;
  return { s, storage };
}

test('storage 접근이 throw해도 죽지 않음', () => {
  const bad = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } } as unknown as Storage;
  const m = memoStore(bad);
  expect(m.ok).toBe(false);
  expect(m.get('x')).toBe('');
  expect(() => m.set('x', 'y')).not.toThrow();
});

test('storage가 null이면 ok:false', () => {
  const m = memoStore(null);
  expect(m.ok).toBe(false);
  expect(m.get('x')).toBe('');
  expect(() => m.set('x', 'y')).not.toThrow();
});

test('읽기는 되지만 쓰기가 막힌 storage(사파리 시크릿 등)도 ok:false', () => {
  const ro = { getItem: () => null, setItem() { throw new Error('QuotaExceededError'); }, removeItem() {} } as unknown as Storage;
  const m = memoStore(ro);
  expect(m.ok).toBe(false);
  expect(() => m.set('x', 'y')).not.toThrow();
});

test('저장·읽기', () => {
  const s = new Map<string, string>();
  const m = memoStore({ getItem: (k: string) => s.get(k) ?? null, setItem: (k: string, v: string) => void s.set(k, v) } as unknown as Storage);
  expect(m.ok).toBe(true);
  m.set('a', '메모');
  expect(m.get('a')).toBe('메모');
  expect(s.get('memo:a')).toBe('메모');
});

test('없는 메모는 빈 문자열', () => {
  const { storage } = mapStorage();
  expect(memoStore(storage).get('none')).toBe('');
});

test('확인용 키를 남기지 않음', () => {
  const { s, storage } = mapStorage();
  memoStore(storage);
  expect(s.size).toBe(0);
});
