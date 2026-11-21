/** localStorage 키. 값은 담은 추천 id의 JSON 문자열 배열(`next:<slug>`, `match:<slug>`) */
export const PLAN_KEY = 'plan';

export interface PlanStore {
  /** false면 이 브라우저에 저장할 수 없다(시크릿 창, 저장소 차단 등) */
  ok: boolean;
  /** 담은 순서대로 */
  list(): string[];
  has(id: string): boolean;
  /** 담기/빼기. 바뀐 뒤 포함 여부를 돌려준다. 저장할 수 없으면 아무것도 하지 않고 false */
  toggle(id: string): boolean;
}

const PROBE = '__plan_probe__';

/** 쓰기까지 실제로 되는지 확인한다. 사파리 시크릿 창은 읽기는 되고 쓰기만 throw한다. */
function writable(storage: Storage): boolean {
  try {
    storage.getItem(PROBE);
    storage.setItem(PROBE, '1');
    if (typeof storage.removeItem === 'function') storage.removeItem(PROBE);
    return true;
  } catch {
    return false;
  }
}

/** 깨진 JSON, 배열이 아닌 값, 문자열이 아닌 원소는 버린다. 중복은 한 번만. */
function parse(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((x): x is string => typeof x === 'string'))];
  } catch {
    return [];
  }
}

/** 공부 계획(추천 카드에서 [계획에 담기]한 목록). 매번 storage에서 읽어 다른 탭의 변경도 반영한다. */
export function planStore(storage: Storage | null): PlanStore {
  const ok = storage !== null && writable(storage);

  const list = (): string[] => {
    if (!ok) return [];
    try {
      return parse(storage!.getItem(PLAN_KEY));
    } catch {
      return [];
    }
  };

  return {
    ok,
    list,
    has: (id) => list().includes(id),
    toggle(id) {
      if (!ok) return false;
      const current = list();
      const on = !current.includes(id);
      const nextList = on ? [...current, id] : current.filter((x) => x !== id);
      try {
        storage!.setItem(PLAN_KEY, JSON.stringify(nextList));
        return on;
      } catch {
        // 용량 초과 등: 바뀌지 않았으니 원래 상태를 돌려준다
        return !on;
      }
    },
  };
}
