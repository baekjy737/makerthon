import { describe, expect, test } from 'vitest';
import { MAX_ISSUE_URL, issueUrl } from '../src/lib/issue';
import { charCount, draftKey, draftStore, essayNumber, refineBody, selectedKey } from '../src/lib/essay';

function mem() {
  const s = new Map<string, string>();
  return {
    s,
    storage: {
      getItem: (k: string) => s.get(k) ?? null,
      setItem: (k: string, v: string) => void s.set(k, v),
      removeItem: (k: string) => void s.delete(k),
    } as unknown as Storage,
  };
}

describe('키', () => {
  test('편집본 키는 essay:<app>/<n>:<entry>', () => {
    expect(draftKey('sample-company', '1', '2025-07-robot-lab-intern')).toBe('essay:sample-company/1:2025-07-robot-lab-intern');
  });
  test('선택한 소재 키는 essay:<app>/<n>', () => {
    expect(selectedKey('sample-company', '1')).toBe('essay:sample-company/1');
  });
  test('essay id에서 문항 번호', () => {
    expect(essayNumber('sample-company/essay-1')).toBe('1');
    expect(essayNumber('a/essay-12')).toBe('12');
    expect(essayNumber('a/odd')).toBe('odd');
  });
});

describe('draftStore', () => {
  test('저장·읽기·지우기', () => {
    const { s, storage } = mem();
    const d = draftStore(storage);
    expect(d.ok).toBe(true);
    expect(d.get('k')).toBeNull();
    d.set('k', '편집본');
    expect(d.get('k')).toBe('편집본');
    d.remove('k');
    expect(s.has('k')).toBe(false);
  });

  test('없는 값은 null(빈 편집본 ""과 구별)', () => {
    const { storage } = mem();
    const d = draftStore(storage);
    d.set('k', '');
    expect(d.get('k')).toBe('');
    expect(d.get('none')).toBeNull();
  });

  test('접근이 throw하면 ok:false, 읽기 null, 쓰기는 false를 돌려주고 죽지 않음', () => {
    const bad = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } } as unknown as Storage;
    const d = draftStore(bad);
    expect(d.ok).toBe(false);
    expect(d.get('k')).toBeNull();
    expect(d.set('k', 'v')).toBe(false);
    expect(() => d.remove('k')).not.toThrow();
  });

  test('null storage', () => {
    const d = draftStore(null);
    expect(d.ok).toBe(false);
    expect(d.set('k', 'v')).toBe(false);
  });

  test('쓰기만 막힌 storage(사파리 시크릿)도 ok:false', () => {
    const ro = { getItem: () => null, setItem() { throw new Error('QuotaExceededError'); }, removeItem() {} } as unknown as Storage;
    expect(draftStore(ro).ok).toBe(false);
  });

  test('용량 초과로 한 번 실패하면 set이 false', () => {
    let fail = false;
    const s = new Map<string, string>();
    const flaky = {
      getItem: (k: string) => s.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (fail) throw new Error('QuotaExceededError');
        s.set(k, v);
      },
      removeItem: (k: string) => void s.delete(k),
    } as unknown as Storage;
    const d = draftStore(flaky);
    expect(d.ok).toBe(true);
    fail = true;
    expect(d.set('k', 'v')).toBe(false);
  });
});

describe('charCount', () => {
  test('공백 포함, 줄바꿈은 1자(\\r\\n도 1자)', () => {
    expect(charCount('가 나')).toBe(3);
    expect(charCount('가\r\n나')).toBe(3);
    expect(charCount('가\n나')).toBe(3);
  });
  test('이모지는 1자', () => {
    expect(charCount('😀가')).toBe(2);
  });
  test('빈 문자열', () => {
    expect(charCount('')).toBe(0);
  });
});

describe('refineBody', () => {
  const base = {
    app: 'sample-company',
    n: '1',
    company: '샘플 회사',
    position: '로봇 소프트웨어 인턴',
    question: '지원 동기와 관련 경험을 적어 주세요.',
    limit: 500,
    entry: { id: '2025-07-robot-lab-intern', title: '로봇 연구실 하계 인턴' },
    draft: '편집한 초안',
    checks: ['성과 수치'],
  };

  test('essay.yml 항목 순서(지원처 → 문항 → 글자 수) 다음에 요청 내용', () => {
    const body = refineBody(base);
    const order = ['### 지원처', '### 자소서 문항', '### 글자 수 제한', '### 다듬기 요청'].map((h) => body.indexOf(h));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(body).toContain('샘플 회사 · 로봇 소프트웨어 인턴');
    expect(body).toContain('content/applications/sample-company/essay-1.md');
    expect(body).toContain('로봇 연구실 하계 인턴 (content/entries/2025-07-robot-lab-intern.md)');
    expect(body).toContain('- 성과 수치');
  });

  test('편집본은 맨 끝(URL이 길면 편집본 끝부터 잘리도록), 글자 수 표시', () => {
    const body = refineBody(base);
    expect(body.trimEnd().endsWith('편집한 초안')).toBe(true);
    expect(body).toContain('#### 편집본 (6자 / 제한 500자)');
  });

  test('제한 없음·확인할 항목 없음·소재 없음', () => {
    const body = refineBody({ ...base, limit: undefined, checks: [], entry: undefined });
    expect(body).toContain('### 글자 수 제한\n\n\n');
    expect(body).not.toContain('#### 확인할 항목');
    expect(body).toContain('선택한 소재: 없음');
    expect(body).toContain('#### 편집본 (6자)');
  });

  test('긴 편집본도 이슈 URL은 MAX_ISSUE_URL 안으로 잘림', () => {
    const body = refineBody({ ...base, draft: '가'.repeat(6000) });
    const url = issueUrl('a/b', { label: 'essay', title: '[자소서] 샘플 회사 · 문항 1', body });
    expect(url.length).toBeLessThanOrEqual(MAX_ISSUE_URL);
    const sent = new URL(url).searchParams.get('body')!;
    expect(sent).toContain('잘렸어요');
    expect(sent).toContain('### 자소서 문항');
  });
});
