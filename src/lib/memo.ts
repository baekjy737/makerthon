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

/** 항목 하나에 딸린 파일(본문 Markdown·첨부·링크) */
export interface MemoFile {
  /** 파일 경로나 URL. 메모 키와 AI에게 보낼 때 위치로 쓴다 */
  ref: string;
  /** 화면에 보일 이름 */
  label: string;
  kind: 'entry' | 'file' | 'link';
  /** 열어 볼 주소(첨부·링크) */
  href?: string;
}

/** 파일별 메모 id. 항목 본문은 예전처럼 항목 id 그대로(`memo:<id>`) 둔다. */
export function fileMemoId(entryId: string, file: Pick<MemoFile, 'kind' | 'ref'>): string {
  return file.kind === 'entry' ? entryId : `${entryId}#${file.ref}`;
}

/**
 * 파일별 메모를 한 이슈 본문으로 묶는다. 빈 메모는 뺀다.
 * `.github/ISSUE_TEMPLATE/memo.yml`로 올린 이슈와 같은 `### 항목 경로` / `### 메모` 틀을 쓴다.
 */
export function memoBody(entryPath: string, notes: (Pick<MemoFile, 'label' | 'ref'> & { text: string })[]): string {
  const filled = notes.filter((n) => n.text.trim() !== '');
  const sections = filled.map((n) => `#### ${n.label} (${n.ref})\n\n${n.text.trim()}`);
  return [
    '### 항목 경로',
    '',
    entryPath,
    '',
    '### 메모',
    '',
    `아래 파일별 메모 ${filled.length}개를 함께 읽고 정리해서 이 항목에 반영해 주세요. 같은 내용은 합치고, 메모에 없는 사실은 더하지 말아 주세요.`,
    '',
    sections.join('\n\n'),
  ].join('\n');
}
