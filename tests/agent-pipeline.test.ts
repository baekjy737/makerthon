import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { docKey, docToPath, markdownToDoc, pathToDoc } from '../scripts/agent/content.mjs';
import { MARK, checkSchema, processRequest } from '../scripts/agent/pipeline.mjs';
import { attachmentUrl, blobBaseUrl } from '../src/lib/attachment';

describe('콘텐츠 경로 ↔ Firestore 문서', () => {
  test.each([
    ['content/entries/2026-03-club.md', 'entries', '2026-03-club'],
    ['content/entries/older/record.md', 'entries', 'older/record'],
    ['content/applications/acme/index.md', 'applications', 'acme'],
    ['content/applications/acme/essay-2.md', 'essays', 'acme/essay-2'],
    ['content/next/topic.md', 'next', 'topic'],
    ['content/matches/lab.md', 'matches', 'lab'],
    ['content/openings/2026-11-x.md', 'openings', '2026-11-x'],
  ])('%s ↔ %s/%s', (path, collection, id) => {
    expect(pathToDoc(path)).toEqual({ collection, id });
    expect(docToPath(collection, id)).toBe(path);
  });

  test('콘텐츠 밖 경로는 null', () => {
    expect(pathToDoc('data/labs.json')).toBeNull();
    expect(pathToDoc('public/archive/a/b.png')).toBeNull();
  });

  test('문서 ID는 /를 인코딩한다', () => {
    expect(docKey('acme/essay-1')).toBe('acme%2Fessay-1');
  });

  test('비공개 항목은 public: false 문서가 된다(보안 규칙이 이 값으로 거른다)', () => {
    const md = '---\ntype: etc\ntitle: 비밀\ndate: 2026-10-01\nsummary: 메모\npublic: false\n---\n본문\n';
    expect(markdownToDoc('entries', 'x', md)).toMatchObject({ id: 'x', public: false, body: '본문\n' });
    expect(markdownToDoc('entries', 'y', md.replace('public: false\n', ''))).toMatchObject({ public: true });
  });

  test('저장소의 샘플 콘텐츠는 모두 스키마를 통과한다(시드 가능)', () => {
    for (const path of ['content/entries/2026-03-coding-club.md', 'content/next/2026-11-replication-stress.md']) {
      expect(() => checkSchema(path, readFileSync(path, 'utf8'))).not.toThrow();
    }
  });

  test('스키마에 안 맞는 콘텐츠는 막는다(배포가 깨지지 않게)', () => {
    expect(() => checkSchema('content/entries/x.md', '---\ntype: nope\ntitle: t\ndate: 2026-01-01\nsummary: s\n---\n')).toThrow(/type/);
  });
});

describe('첨부 주소', () => {
  test('Blob 토큰에서 공개 스토어 주소를 만든다', () => {
    expect(blobBaseUrl({ BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_AbC123_secret' })).toBe('https://abc123.public.blob.vercel-storage.com');
    expect(blobBaseUrl({})).toBeNull();
  });
  test('public/에 없으면 Blob 주소, Blob 설정이 없으면 사이트 경로', () => {
    const env = { BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_store1_x' };
    expect(attachmentUrl('archive/none/a.png', env)).toBe('https://store1.public.blob.vercel-storage.com/archive/none/a.png');
    expect(attachmentUrl('archive/none/a.png', {})).toMatch(/\/archive\/none\/a\.png$/);
  });
});

// 메모리 저장소로 파이프라인 전체를 돌린다(AI는 정해진 결과를 돌려주는 가짜)
function memoryStore(seed: Record<string, string>) {
  const files = new Map(Object.entries(seed));
  const comments: { author: string; bot: boolean; body: string; createdAt: string }[] = [];
  const request = { number: 1, route: 'archive', title: '동아리 기록', body: '코딩 동아리 활동', createdAt: '2026-11-21T00:00:00Z' };
  return {
    files,
    comments,
    request,
    store: {
      async exportContent(dir: string) {
        for (const [p, md] of files) {
          mkdirSync(dirname(join(dir, p)), { recursive: true });
          writeFileSync(join(dir, p), md);
        }
      },
      async saveContent(list: { path: string; markdown: string }[]) {
        for (const f of list) files.set(f.path, f.markdown);
      },
      async getRequest() {
        return request;
      },
      async setRoute(_n: number, route: string) {
        request.route = route;
      },
      async listComments() {
        return comments;
      },
      async addComment(_n: number, bot: boolean, body: string) {
        comments.push({ author: bot ? 'claude' : 'me', bot, body, createdAt: new Date().toISOString() });
      },
    },
  };
}

const ENTRY = '---\ntype: activity\ntitle: 코딩 동아리\ndate: 2026-03\nsummary: 알고리즘 스터디 운영\n---\n본문\n';
const PRIVATE = '---\ntype: etc\ntitle: 비밀\ndate: 2026-10-01\nsummary: 메모\npublic: false\n---\n';

describe('AI 파이프라인', () => {
  const base = { readUpload: async () => null, saveFile: async () => {}, repoRoot: process.cwd() };

  test('ready 결과는 검증 뒤 저장하고 반영 표시를 남긴다', async () => {
    const m = memoryStore({});
    let changed = 0;
    let sawClaude = false;
    await processRequest(1, {
      ...base,
      store: m.store,
      afterChange: async () => void changed++,
      runAI: async (dir: string) => {
        sawClaude = existsSync(join(dir, 'CLAUDE.md')) && !readFileSync(join(dir, 'CLAUDE.md'), 'utf8').includes('@AGENTS.md');
        return { status: 'ready', message: '기록했어요.', files: [{ path: 'content/entries/2026-03-club.md', markdown: ENTRY }], attachments: [] };
      },
    });
    expect(sawClaude).toBe(true);
    expect(m.files.get('content/entries/2026-03-club.md')).toBe(ENTRY);
    expect(changed).toBe(1);
    expect(m.comments.at(-1)!.body).toContain(MARK.done);
  });

  test('기존 항목의 공개 설정을 바꾸면 저장하지 않는다(ai-content.mjs 규칙)', async () => {
    const m = memoryStore({ 'content/entries/2026-10-note.md': PRIVATE });
    await processRequest(1, {
      ...base,
      store: m.store,
      runAI: async () => ({
        status: 'ready',
        message: '공개로 바꿨어요.',
        files: [{ path: 'content/entries/2026-10-note.md', markdown: PRIVATE.replace('public: false\n', 'public: true\n') }],
        attachments: [],
      }),
    });
    expect(m.files.get('content/entries/2026-10-note.md')).toBe(PRIVATE);
    expect(m.comments.at(-1)!.body).toContain(MARK.failed);
  });

  test('스키마에 안 맞는 결과는 저장하지 않는다', async () => {
    const m = memoryStore({});
    await processRequest(1, {
      ...base,
      store: m.store,
      runAI: async () => ({
        status: 'ready',
        message: '',
        files: [{ path: 'content/entries/2026-03-bad.md', markdown: ENTRY.replace('summary: 알고리즘 스터디 운영\n', '') }],
        attachments: [],
      }),
    });
    expect(m.files.has('content/entries/2026-03-bad.md')).toBe(false);
    expect(m.comments.at(-1)!.body).toContain(MARK.failed);
  });

  test('질문이면 질문 표시를 남기고 memo는 archive로 이어 받는다. 업로드는 지우지 않는다', async () => {
    const m = memoryStore({});
    m.request.route = 'memo';
    let cleaned = false;
    await processRequest(1, {
      ...base,
      store: m.store,
      cleanupUploads: async () => void (cleaned = true),
      runAI: async () => ({ status: 'question', message: '언제 활동했나요?', files: [], attachments: [] }),
    });
    expect(m.request.route).toBe('archive');
    expect(m.comments.at(-1)!.body).toContain(MARK.question);
    expect(cleaned).toBe(false);
  });

  test('AI 실패도 댓글로 남긴다', async () => {
    const m = memoryStore({});
    await processRequest(1, {
      ...base,
      store: m.store,
      runAI: async () => {
        throw new Error('네트워크 오류');
      },
    });
    expect(m.comments.at(-1)!.body).toMatch(/자동 처리에 실패했어요\. 네트워크 오류/);
  });
});
