import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { contentPath } from '../.github/scripts/ai-content.mjs';

describe('AI 콘텐츠 경로', () => {
  test.each([
    ['content/next/2026-11-topic.md', 'next'],
    ['content/matches/2026-11-lab.md', 'match'],
    ['content/entries/2026-11-record.md', 'entry'],
    ['content/entries/older/record.md', 'entry'],
    ['content/applications/company/index.md', 'application'],
    ['content/applications/company/essay-2.md', 'application'],
  ])('%s의 콘텐츠 종류는 %s다', (path, kind) => {
    expect(contentPath(path)).toBe(kind);
  });

  test.each([
    'data/labs.json', 'content/next/../x.md', 'content/matches/a/b.md', 'profile.yml',
    '/content/next/topic.md', 'content/next/topic.mdx', 'content/applications/company/details.md',
  ])('%s는 콘텐츠 출력 경로로 허용하지 않는다', (path) => {
    expect(contentPath(path)).toBeNull();
  });
});

describe('추천 결과 반영', () => {
  const cli = fileURLToPath(new URL('../.github/scripts/ai-content.mjs', import.meta.url));
  const entry = {
    path: 'content/entries/record.md',
    markdown: '---\ntype: study\ntitle: 학습 기록\ndate: 2026-11-21\nsummary: 정렬 복습\n---\n',
  };
  const next = {
    path: 'content/next/topic.md',
    markdown: '---\ntopic: 정렬\ncreated: 2026-11-21\nfrom: [record]\nlearned: [비교]\nnext: [복잡도]\n---\n',
  };
  const match = {
    path: 'content/matches/opportunity.md',
    markdown: '---\nkind: lab\ntarget: LAB-A\ncreated: 2026-11-21\nfrom: [record]\nscore: 70\nreason: 알고리즘 연구\nsources: [{label: 연구실, url: "https://example.org/lab"}]\n---\n',
  };
  let root: string;

  function write(path: string, text: string) {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text);
  }

  function runCli(command: string) {
    return spawnSync(process.execPath, [cli, command], {
      cwd: root, encoding: 'utf8', env: { ...process.env, AI_RESULT_FILE: '.archive-input/result.json' },
    });
  }

  function apply(route: string, files: { path: string; markdown: string }[]) {
    write('.archive-input/issue.json', JSON.stringify({ route }));
    write('.archive-input/result.json', JSON.stringify({ status: 'ready', message: '완료', files, attachments: [] }));
    return runCli('apply');
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'makerthon-ai-content-'));
    write('.archive-input/attachments.json', '[]');
    write('data/courses.json', JSON.stringify([{ name: '자료구조' }]));
    write('data/labs.json', JSON.stringify([{ id: 'LAB-A', courses: ['유전학'], homepage: 'https://example.org/lab' }]));
    write('data/interns.json', JSON.stringify([{ id: 'INT-A', company: '학생기업', url: 'https://example.org/intern' }]));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  test.each(['archive', 'memo'])('%s 결과에서는 같은 실행의 공개 기록을 순서와 관계없이 인용한다', (route) => {
    const run = apply(route, [next, entry]);
    expect(run.status, run.stderr).toBe(0);
    expect(readFileSync(join(root, next.path), 'utf8')).toBe(next.markdown);
    expect(readFileSync(join(root, entry.path), 'utf8')).toBe(entry.markdown);
  });

  test('recommend는 이미 저장된 공개 항목을 인용할 수 있다', () => {
    write(entry.path, entry.markdown);
    const run = apply('recommend', [next]);
    expect(run.status, run.stderr).toBe(0);
    expect(readFileSync(join(root, next.path), 'utf8')).toBe(next.markdown);
  });

  test.each(['없는 항목', '비공개 항목'])('근거가 %s이면 추천을 기록하지 않는다', (kind) => {
    if (kind === '비공개 항목') write(entry.path, entry.markdown.replace('type: study', 'public: false\ntype: study'));
    const run = apply('recommend', [next]);
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain('공개 항목');
    expect(existsSync(join(root, next.path))).toBe(false);
  });

  test('추천 전용 요청에서 공개 기록 자체를 수정할 수 없다', () => {
    write(entry.path, entry.markdown);
    const run = apply('recommend', [next, { ...entry, markdown: entry.markdown + '수정\n' }]);
    expect(run.status).not.toBe(0);
    expect(readFileSync(join(root, entry.path), 'utf8')).toBe(entry.markdown);
    expect(existsSync(join(root, next.path))).toBe(false);
  });

  test('공고 분석 결과에는 추천 카드를 추가할 수 없다', () => {
    write(entry.path, entry.markdown);
    const run = apply('job', [next]);
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain('추천 파일을 수정할 수 없습니다');
    expect(existsSync(join(root, next.path))).toBe(false);
  });

  test.each([
    ['content/matches/target.md', 'sources'],
    ['content/next/topic.md', 'resources'],
  ])('%s의 링크에도 공개 콘텐츠 URL 검사를 적용한다', (path, field) => {
    write(entry.path, entry.markdown);
    const markdown = `---\nkind: lab\ntarget: LAB-A\nfrom: [record]\n${field}: [{label: 자료, url: "file:///example"}]\n---\n`;
    const run = apply('recommend', [{ path, markdown }]);
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain('허용되지 않는 링크');
  });

  test.each([
    ['lab', 'LAB-A', 'https://example.org/lab'],
    ['intern', 'INT-A', 'https://example.org/intern'],
    ['company', '학생기업', 'https://example.org/intern'],
  ])('%s 추천의 대상과 출처가 같은 데이터 레코드에 있다', (kind, target, url) => {
    write(entry.path, entry.markdown);
    const markdown = match.markdown.replace('kind: lab', 'kind: ' + kind)
      .replace('LAB-A', target).replace('https://example.org/lab', url);
    const run = apply('recommend', [{ ...match, markdown }]);
    expect(run.status, run.stderr).toBe(0);
  });

  test.each([
    ['target: LAB-A', 'target: OTHER'],
    ['https://example.org/lab', 'https://example.org/intern'],
  ])('데이터에 대응하지 않는 대상·출처를 거부한다 (%s)', (before, after) => {
    write(entry.path, entry.markdown);
    const run = apply('recommend', [{ ...match, markdown: match.markdown.replace(before, after) }]);
    expect(run.status).not.toBe(0);
    expect(existsSync(join(root, match.path))).toBe(false);
  });

  test.each([['자료구조', true], ['유전학', true], ['없는 과목', false]])('과목명 %s의 데이터 등록 여부 확인', (course, valid) => {
    write(entry.path, entry.markdown);
    const markdown = next.markdown.replace('learned:', `resources: [{label: 과목, course: "${course}"}]\nlearned:`);
    expect(apply('recommend', [{ ...next, markdown }]).status === 0).toBe(valid);
  });

  test('재배치 뒤 근거의 공개 여부와 실제 커밋될 추천 본문을 다시 읽는다', () => {
    expect(apply('archive', [next, entry]).status).toBe(0);
    write(entry.path, entry.markdown.replace('type: study', 'public: false\ntype: study'));
    const privateEvidence = runCli('verify-recommendations');
    expect(privateEvidence.status).not.toBe(0);
    expect(privateEvidence.stderr).toContain('공개 항목');

    write(entry.path, entry.markdown);
    write(next.path, next.markdown.replace('from: [record]', 'from: [missing]'));
    expect(runCli('verify-recommendations').status).not.toBe(0);
    write(next.path, next.markdown);
    expect(runCli('verify-recommendations').status).toBe(0);
  });

  test.each([[next, 3], [match, 5]] as const)('추천 파일 종류별 한 번의 실행 상한', (file, limit) => {
    write(entry.path, entry.markdown);
    if (file === match) {
      const labs = Array.from({ length: limit + 1 }, (_, i) => ({
        id: `LAB-${i}`, courses: [], homepage: 'https://example.org/lab',
      }));
      write('data/labs.json', JSON.stringify(labs));
    }
    const batch = Array.from({ length: limit + 1 }, (_, i) => ({
      path: file.path.replace('.md', `-${i + 1}.md`),
      markdown: file.markdown.replace('topic: 정렬', `topic: 정렬 ${i}`).replace('target: LAB-A', `target: LAB-${i}`),
    }));
    const atLimit = apply('recommend', batch.slice(0, limit));
    expect(atLimit.status, atLimit.stderr).toBe(0);
    expect(apply('recommend', batch).status).not.toBe(0);
    expect(existsSync(join(root, batch[limit].path))).toBe(false);
  });

  test.each([next, match])('같은 주제·대상은 기존 경로에서 갱신한다 ($path)', (file) => {
    write(entry.path, entry.markdown);
    const duplicate = { ...file, path: file.path.replace('.md', '-other.md') };
    const sameBatch = apply('recommend', [file, duplicate]);
    expect(sameBatch.status).not.toBe(0);
    expect(sameBatch.stderr).toContain('중복');
    expect(existsSync(join(root, file.path))).toBe(false);

    write(file.path, file.markdown);
    expect(apply('recommend', [duplicate]).status).not.toBe(0);
    const updated = { ...file, markdown: file.markdown + '새로 확인한 내용\n' };
    const run = apply('recommend', [updated]);
    expect(run.status, run.stderr).toBe(0);
    expect(readFileSync(join(root, file.path), 'utf8')).toBe(updated.markdown);

    write(duplicate.path, duplicate.markdown);
    const rebased = runCli('verify-recommendations');
    expect(rebased.status).not.toBe(0);
    expect(rebased.stderr).toContain(duplicate.path);
  });

  test('이번 변경과 무관한 기존 중복 카드는 새 주제 등록을 막지 않는다', () => {
    write(entry.path, entry.markdown);
    const older = next.markdown.replace('topic: 정렬', 'topic: 탐색');
    write('content/next/a.md', older);
    write('content/next/b.md', older);
    const run = apply('recommend', [next]);
    expect(run.status, run.stderr).toBe(0);
  });
});
