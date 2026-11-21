// 지원서 작성 화면(EssayWorkspace) 도우미: 편집본 저장, 글자 수, [다듬기 요청] 이슈 본문.

/** 소재별 편집본 localStorage 키: `essay:<app>/<n>:<entry>` */
export const draftKey = (app: string, n: string, entry: string) => `essay:${app}/${n}:${entry}`;

/** 문항에서 마지막으로 고른 소재: `essay:<app>/<n>` */
export const selectedKey = (app: string, n: string) => `essay:${app}/${n}`;

/** essays 컬렉션 id(`<app>/essay-<n>`)에서 문항 번호 */
export function essayNumber(essayId: string): string {
  const file = essayId.split('/').pop() ?? essayId;
  return file.replace(/^essay-/, '');
}

export interface DraftStore {
  /** false면 이 브라우저에 저장할 수 없다(시크릿 창, 저장소 차단 등) */
  ok: boolean;
  /** 저장된 값이 없으면 null (빈 편집본 ''과 구별) */
  get(key: string): string | null;
  /** 저장에 성공하면 true. 용량 초과 등으로 실패하면 false */
  set(key: string, value: string): boolean;
  remove(key: string): void;
}

const PROBE = '__essay_probe__';

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

/** 저장소가 없거나 막혀 있어도 throw하지 않는다. */
export function draftStore(storage: Storage | null): DraftStore {
  const ok = storage !== null && writable(storage);
  return {
    ok,
    get(key) {
      if (!ok) return null;
      try {
        return storage!.getItem(key);
      } catch {
        return null;
      }
    },
    set(key, value) {
      if (!ok) return false;
      try {
        storage!.setItem(key, value);
        return true;
      } catch {
        return false;
      }
    },
    remove(key) {
      if (!ok) return;
      try {
        storage!.removeItem(key);
      } catch {
        // 무시
      }
    },
  };
}

/** 지원서 글자 수: 공백 포함, 줄바꿈은 1자(\r\n도 1자), 이모지 등은 코드 포인트 1자 */
export function charCount(text: string): number {
  return [...text.replace(/\r\n/g, '\n')].length;
}

export interface RefineInput {
  app: string;
  /** 문항 번호 */
  n: string;
  company: string;
  position: string;
  question: string;
  limit?: number;
  /** 선택한 소재(공개 항목). 없으면 undefined */
  entry?: { id: string; title: string };
  draft: string;
  checks: string[];
}

/**
 * [다듬기 요청] essay 이슈 본문.
 * `.github/ISSUE_TEMPLATE/essay.yml` 항목 순서(지원처 → 자소서 문항 → 글자 수 제한)를 지키고, 그 뒤에 요청 내용을 둔다.
 * URL이 길면 issueUrl이 본문 끝부터 자르므로 편집본을 맨 끝에 둔다.
 */
export function refineBody(x: RefineInput): string {
  const count = charCount(x.draft);
  const countLabel = x.limit != null ? `${count}자 / 제한 ${x.limit}자` : `${count}자`;
  return [
    '### 지원처',
    '',
    `${x.company} · ${x.position}`,
    '',
    '### 지원서 양식 파일(PDF·이미지) 또는 문항 원문',
    '',
    x.question,
    '',
    '### 공통 글자 수 제한 (선택)',
    '',
    x.limit != null ? String(x.limit) : '',
    '',
    '### 다듬기 요청',
    '',
    `지원 건: content/applications/${x.app}/essay-${x.n}.md`,
    `선택한 소재: ${x.entry ? `${x.entry.title} (content/entries/${x.entry.id}.md)` : '없음'}`,
    '',
    '아래 편집본을 글자 수 제한 안에서 다듬어 주세요. 기록과 편집본에 없는 사실은 더하지 말고, 확인할 항목은 질문으로 남겨 주세요.',
    ...(x.checks.length > 0 ? ['', '#### 확인할 항목', '', ...x.checks.map((c) => `- ${c}`)] : []),
    '',
    `#### 편집본 (${countLabel})`,
    '',
    x.draft,
  ].join('\n');
}
