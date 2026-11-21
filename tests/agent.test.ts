import { afterEach, describe, expect, test, vi } from 'vitest';
import { issueUrl } from '../src/lib/issue';
import {
  GitHubError,
  MAX_UPLOAD_BYTES,
  createClient,
  githubError,
  issueStatus,
  newNonce,
  parseIssueUrl,
  safeFilename,
  uploadLine,
} from '../src/lib/agent';

const repo = 'me/site';

test('parseIssueUrl: 자기 저장소의 이슈 작성 URL만 읽는다', () => {
  const href = issueUrl(repo, { label: 'archive', title: '[기록] ', body: '### 활동 메모\n\n한글' });
  expect(parseIssueUrl(href, repo)).toEqual({ label: 'archive', title: '[기록] ', body: '### 활동 메모\n\n한글' });
  expect(parseIssueUrl(href.replace('me/site', 'evil/site'), repo)).toBeNull();
  expect(parseIssueUrl(`https://github.com/${repo}/issues/new?labels=bug&title=a&body=b`, repo)).toBeNull();
  expect(parseIssueUrl(`https://github.com/${repo}/issues/3`, repo)).toBeNull();
});

test('parseIssueUrl: 다른 호스트·저장소 이름 접두어·잘못된 URL은 null', () => {
  const href = issueUrl(repo, { label: 'memo', title: 't', body: 'b' });
  expect(parseIssueUrl(href.replace('https://github.com', 'https://evil.com'), repo)).toBeNull();
  expect(parseIssueUrl(href.replace('me/site', 'me/site-other'), repo)).toBeNull();
  expect(parseIssueUrl('not a url', repo)).toBeNull();
  expect(parseIssueUrl(`https://github.com/${repo}/issues/new?title=a`, repo)).toBeNull();
});

test('safeFilename: 허용 문자만 남기고 비면 file-<n>', () => {
  expect(safeFilename('My CV (final).pdf', 0)).toBe('My-CV-final.pdf');
  expect(safeFilename('이력서.pdf', 1)).toBe('file-2.pdf');
  expect(safeFilename('../.env', 0)).toBe('file-1.env');
  expect(safeFilename('a'.repeat(300) + '.png', 0)).toHaveLength(100);
});

test('safeFilename: 결과는 업로드 참조의 파일명 규칙을 지킨다', () => {
  const rule = /^[A-Za-z0-9_-][A-Za-z0-9._-]{0,99}$/;
  for (const name of ['사진.JPG', '...', '.hidden.png', 'a b c', 'x'.repeat(200), 'noext', '한글 이름 2026.pdf', '-.-.png']) {
    expect(safeFilename(name, 4)).toMatch(rule);
    expect(safeFilename(name, 4)).not.toContain('..');
  }
  expect(safeFilename('사진.JPG', 0)).toBe('file-1.jpg');
});

test('newNonce는 16자 소문자·숫자', () => {
  expect(newNonce()).toMatch(/^[a-z0-9]{16}$/);
  expect(newNonce()).not.toBe(newNonce());
});

test('uploadLine 형식', () => {
  expect(uploadLine('abcdefghij012345', 'cv.pdf')).toBe('첨부: upload/abcdefghij012345/cv.pdf');
});

describe('issueStatus', () => {
  const since = '2026-11-21T00:00:00Z';
  const bot = (body: string, t: string) => ({ author: 'github-actions[bot]', bot: true, body, createdAt: t });
  const me = (body: string, t: string) => ({ author: 'me', bot: false, body, createdAt: t });
  const at = (m: number) => new Date(Date.parse(since) + m * 60_000);

  test('댓글 없음 → working, 40분 넘으면 slow', () => {
    expect(issueStatus([], since, at(5))).toEqual({ status: 'working', slow: false });
    expect(issueStatus([], since, at(41))).toEqual({ status: 'working', slow: true });
  });

  test('질문·완료·실패', () => {
    expect(issueStatus([bot('<!-- archive-question -->\n언제였나요?', '2026-11-21T00:03:00Z')], since, at(4)).status).toBe('question');
    expect(issueStatus([bot('PR #12 병합으로 기록을 반영했어요.', '2026-11-21T00:03:00Z')], since, at(4)).status).toBe('done');
    expect(issueStatus([bot('이미 같은 내용이 기록되어 있어요.', '2026-11-21T00:03:00Z')], since, at(4)).status).toBe('done');
    expect(issueStatus([bot('자동 처리에 실패했어요. 실행 로그: x', '2026-11-21T00:03:00Z')], since, at(4)).status).toBe('failed');
    expect(issueStatus([bot('콘텐츠 검증 또는 빌드가 실패해서 반영하지 않았어요. 실행 로그: x', '2026-11-21T00:03:00Z')], since, at(4)).status).toBe('failed');
  });

  test('질문 뒤 내 답이 있으면 working이고, slow는 내 답 시각부터 센다', () => {
    const c = [bot('<!-- archive-question -->\n?', '2026-11-21T00:03:00Z'), me('2025년 3월', '2026-11-21T00:30:00Z')];
    expect(issueStatus(c, since, at(50))).toEqual({ status: 'working', slow: false });
    expect(issueStatus(c, since, at(71))).toEqual({ status: 'working', slow: true });
  });

  test('의미 없는 봇 댓글(배포 안내 등)은 건너뛴다', () => {
    const c = [bot('PR #3 병합으로 기록을 반영했어요.', '2026-11-21T00:03:00Z'), bot('다른 봇 알림', '2026-11-21T00:04:00Z')];
    expect(issueStatus(c, since, at(5)).status).toBe('done');
  });

  test('완료 뒤 다시 답하면(재실행) working', () => {
    const c = [bot('이미 같은 내용이 기록되어 있어요.', '2026-11-21T00:03:00Z'), me('하나 더 추가해 주세요', '2026-11-21T00:05:00Z')];
    expect(issueStatus(c, since, at(6)).status).toBe('working');
  });
});

test('githubError: 401·403·404는 토큰 안내', () => {
  for (const s of [401, 403, 404]) expect(githubError(s)).toContain('토큰');
  expect(githubError(422)).not.toContain('토큰');
  expect(githubError(500)).not.toContain('토큰');
});

describe('createClient', () => {
  afterEach(() => vi.unstubAllGlobals());

  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const file = (name: string, type: string, size = 4) => new File([new Uint8Array(size)], name, { type });

  test('모든 요청은 api.github.com/repos/<repo>에 Bearer 토큰으로', async () => {
    const fetchMock = vi.fn(async () => json(201, { number: 7, html_url: 'https://github.com/me/site/issues/7', created_at: '2026-11-21T00:00:00Z' }));
    vi.stubGlobal('fetch', fetchMock);
    const out = await createClient(repo, 'tok').createIssue({ label: 'memo', title: 't', body: 'b' });
    expect(out).toEqual({ number: 7, url: 'https://github.com/me/site/issues/7', createdAt: '2026-11-21T00:00:00Z' });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.github.com/repos/me/site/issues');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(JSON.parse(init.body as string)).toEqual({ title: 't', body: 'b', labels: ['memo'] });
  });

  test('401이면 GitHubError(토큰 안내)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(401, { message: 'Bad credentials' })));
    const p = createClient(repo, 'bad').createIssue({ label: 'memo', title: 't', body: 'b' });
    await expect(p).rejects.toBeInstanceOf(GitHubError);
    await expect(p).rejects.toMatchObject({ status: 401 });
  });

  test('네트워크 오류도 GitHubError로', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(createClient(repo, 't').comments(1)).rejects.toBeInstanceOf(GitHubError);
  });

  test('업로드: 파일이 없으면 요청 없이 []', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await createClient(repo, 't').uploadFiles([])).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('업로드: 10MB 초과나 허용 밖 형식이면 요청 전에 실패', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const c = createClient(repo, 't');
    await expect(c.uploadFiles([file('big.pdf', 'application/pdf', MAX_UPLOAD_BYTES + 1)])).rejects.toThrow('10MB');
    await expect(c.uploadFiles([file('a.txt', 'text/plain')])).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('업로드: main sha → upload/<nonce> 브랜치 → 파일마다 PUT, 겹치는 이름은 번호를 붙임', async () => {
    const calls: { url: string; method: string; body?: any }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit = {}) => {
        calls.push({ url, method: init.method ?? 'GET', body: init.body ? JSON.parse(init.body as string) : undefined });
        if (url.endsWith('/git/ref/heads/main')) return json(200, { object: { sha: 'abc' } });
        if (url.endsWith('/git/refs')) return json(201, {});
        return json(201, {});
      }),
    );
    const lines = await createClient(repo, 't').uploadFiles([file('사진.png', 'image/png'), file('그림.png', 'image/png'), file('cv.pdf', 'application/pdf')]);
    expect(lines).toHaveLength(3);
    const nonce = lines[0].match(/^첨부: upload\/([a-z0-9]{16})\//)![1];
    expect(lines).toEqual([`첨부: upload/${nonce}/file-1.png`, `첨부: upload/${nonce}/file-2.png`, `첨부: upload/${nonce}/cv.pdf`]);
    expect(calls[0]).toMatchObject({ method: 'GET', url: 'https://api.github.com/repos/me/site/git/ref/heads/main' });
    expect(calls[1]).toMatchObject({ method: 'POST', body: { ref: `refs/heads/upload/${nonce}`, sha: 'abc' } });
    expect(calls.slice(2).map((c) => [c.method, c.url, c.body.branch])).toEqual([
      ['PUT', 'https://api.github.com/repos/me/site/contents/file-1.png', `upload/${nonce}`],
      ['PUT', 'https://api.github.com/repos/me/site/contents/file-2.png', `upload/${nonce}`],
      ['PUT', 'https://api.github.com/repos/me/site/contents/cv.pdf', `upload/${nonce}`],
    ]);
    expect(typeof calls[2].body.content).toBe('string');
  });

  test('업로드: 같은 안전 이름이 두 번 나오면 <index>- 를 붙인다', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (url.endsWith('/git/ref/heads/main') ? json(200, { object: { sha: 'abc' } }) : json(201, {}))));
    const lines = await createClient(repo, 't').uploadFiles([file('cv.pdf', 'application/pdf'), file('cv.pdf', 'application/pdf')]);
    expect(lines[0].endsWith('/cv.pdf')).toBe(true);
    expect(lines[1].endsWith('/1-cv.pdf')).toBe(true);
  });

  test('댓글: bot은 user.type === Bot', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        json(200, [
          { user: { login: 'github-actions[bot]', type: 'Bot' }, body: 'x', created_at: '2026-11-21T00:01:00Z' },
          { user: { login: 'me', type: 'User' }, body: 'y', created_at: '2026-11-21T00:02:00Z' },
        ]),
      ),
    );
    expect(await createClient(repo, 't').comments(3)).toEqual([
      { author: 'github-actions[bot]', bot: true, body: 'x', createdAt: '2026-11-21T00:01:00Z' },
      { author: 'me', bot: false, body: 'y', createdAt: '2026-11-21T00:02:00Z' },
    ]);
  });
});
