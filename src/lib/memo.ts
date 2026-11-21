export interface MemoStore {
  /** false면 이 브라우저에 저장할 수 없다(시크릿 창, 저장소 차단 등) */
  ok: boolean;
  get(id: string): string;
  set(id: string, text: string): void;
}

const PREFIX = 'memo:';
const PROBE = '__memo_probe__';

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

/** 항목별 메모를 localStorage(`memo:<id>`)에 저장한다. 저장소가 없거나 막혀 있어도 throw하지 않는다. */
export function memoStore(storage: Storage | null): MemoStore {
  const ok = storage !== null && writable(storage);
  return {
    ok,
    get(id) {
      if (!ok) return '';
      try {
        return storage!.getItem(PREFIX + id) ?? '';
      } catch {
        return '';
      }
    },
    set(id, text) {
      if (!ok) return;
      try {
        storage!.setItem(PREFIX + id, text);
      } catch {
        // 용량 초과 등: 화면의 내용은 그대로 두고 저장만 건너뛴다
      }
    },
  };
}
