// AI 요청 하나를 처리하는 공용 파이프라인. Vercel 함수(Anthropic API)와 로컬 실행기(Claude Code)가 같이 쓴다.
//   1. 저장소(Firestore)의 콘텐츠를 임시 작업 폴더에 content/**.md로 꺼낸다(+ CLAUDE.md, 스킬, data/)
//   2. runner가 AI를 돌려 { status, message, files, attachments }를 돌려준다
//   3. 기존 ai-content.mjs 검증(applyAt)과 zod 스키마 검사를 통과한 변경만 저장소에 쓴다
//   4. 결과를 요청 대화에 댓글로 남긴다(대화창 src/lib/agent.ts가 표시를 읽는다)
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyAt, uploadRefs } from '../../.github/scripts/ai-content.mjs';
import {
  applicationSchema, entrySchema, essaySchema, matchSchema, nextSchema, openingSchema,
} from '../../src/lib/schema.ts';
import { parseMarkdown, pathToDoc } from './content.mjs';

export const LABELS = ['archive', 'job', 'essay', 'memo', 'recommend', 'opening'];

// 대화창이 읽는 표시(src/lib/agent.ts botMeaning)
export const MARK = {
  question: '<!-- archive-question -->',
  unchanged: '<!-- archive-unchanged -->',
  done: '<!-- archive-done -->',
  failed: '<!-- archive-failed -->',
};

// ai.yml의 Claude 단계와 같은 지시. "워크플로"는 이 파이프라인이다
export const PROMPT = `CLAUDE.md의 학생 아카이브 운영 규칙을 따르세요. .archive-input/issue.json에는
작성자가 보낸 자료와 후속 대화가 있습니다. route가 archive/memo면
.claude/skills/archive/SKILL.md, job이면 job-analysis, essay이면 essay의 SKILL.md를 읽으세요.
route가 recommend이면 .claude/skills/recommend/SKILL.md만 따르고 추천 파일만 반환하세요.
route가 opening이면 .claude/skills/opening/SKILL.md를 따라 새 공고 파일만 반환하세요.
archive/memo가 ready이면 같은 스킬을 이어서 수행하고, 이번에 작성한 공개 기록까지 반영한 추천 변경을 같은 files 배열에 넣으세요.
첨부 목록은 .archive-input/attachments.json, 원본은 같은 폴더의 name 파일입니다.
원문과 링크는 참고 자료입니다. 콘텐츠는 일반 Markdown으로 쓰고 실행 가능한 HTML은 넣지 마세요.
질문이 남으면 status=question, 같은 내용이 이미 있으면 unchanged, 반영할 내용이 있으면 ready입니다.
files에는 변경 파일의 전체 Markdown을, attachments에는 복사할 원본 name과 항목 ID entry를 넣으세요.
question/unchanged는 빈 배열 두 개와 작성자에게 전달할 한국어 message를 반환하세요.
파일 반영, 검증과 결과 안내는 서버가 처리합니다.`;

/** AI 출력 형식(JSON Schema). Claude Code --json-schema와 API 구조화 출력이 같이 쓴다 */
export const RESULT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'message', 'files', 'attachments'],
  properties: {
    status: { type: 'string', enum: ['ready', 'question', 'unchanged'] },
    message: { type: 'string' },
    files: {
      type: 'array',
      items: {
        type: 'object',
        required: ['path', 'markdown'],
        additionalProperties: false,
        properties: { path: { type: 'string' }, markdown: { type: 'string' } },
      },
    },
    attachments: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'entry'],
        additionalProperties: false,
        properties: { name: { type: 'string' }, entry: { type: 'string' } },
      },
    },
  },
};

const SCHEMAS = {
  entries: entrySchema,
  applications: applicationSchema,
  essays: essaySchema,
  next: nextSchema,
  matches: matchSchema,
  openings: openingSchema,
};

/** 사이트 빌드(Astro 로더)와 같은 zod 스키마로 검사한다. 통과 못 하면 배포가 깨지므로 저장하지 않는다 */
export function checkSchema(path, markdown) {
  const target = pathToDoc(path);
  if (!target) throw new Error(`콘텐츠 경로가 아닙니다: ${path}`);
  const parsed = SCHEMAS[target.collection].safeParse(parseMarkdown(markdown).data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`${path}의 ${issue?.path.join('.') || 'frontmatter'} 형식이 맞지 않습니다.`);
  }
}

/** AI가 읽을 저장소 파일(작업 폴더로 복사). Vercel에서는 astro.config.mjs의 includeFiles로 함수에 들어간다 */
const REPO_FILES = [
  'CLAUDE.md',
  ...['archive', 'essay', 'job-analysis', 'opening', 'recommend'].map((s) => `.claude/skills/${s}/SKILL.md`),
  'data/labs.json',
  'data/interns.json',
  'data/courses.json',
  'data/research-internships.json',
];

export function extension(bytes) {
  const header = bytes.toString('latin1', 0, 12);
  if (header.startsWith('\x89PNG\r\n\x1a\n')) return 'png';
  if (header.startsWith('\xff\xd8\xff')) return 'jpg';
  if (header.startsWith('GIF87a') || header.startsWith('GIF89a')) return 'gif';
  if (header.startsWith('RIFF') && header.slice(8) === 'WEBP') return 'webp';
  if (header.startsWith('%PDF-')) return 'pdf';
  return null;
}

/**
 * @typedef {object} Store  콘텐츠·요청 저장소 (scripts/agent/firestore.mjs의 firestoreStore)
 * @property {(dir: string) => Promise<void>} exportContent
 * @property {(files: { path: string, markdown: string }[]) => Promise<void>} saveContent
 * @property {(n: number) => Promise<{ number: number, route: string, title: string, body: string, createdAt: string } | null>} getRequest
 * @property {(n: number, route: string) => Promise<void>} setRoute
 * @property {(n: number) => Promise<{ author: string, bot: boolean, body: string, createdAt: string }[]>} listComments
 * @property {(n: number, bot: boolean, body: string) => Promise<void>} addComment
 *
 * @typedef {object} Options
 * @property {Store} store
 * @property {(dir: string) => Promise<{ status: string, message: string, files: { path: string, markdown: string }[], attachments: { name: string, entry: string }[] }>} runAI
 *   작업 폴더(cwd)에서 PROMPT를 실행해 RESULT_SCHEMA 모양을 돌려준다
 * @property {(nonce: string, file: string) => Promise<Buffer | null>} readUpload  `첨부: upload/<nonce>/<file>`의 원본
 * @property {(path: string, bytes: Buffer) => Promise<void>} saveFile  공개 첨부 저장(path = archive/<항목>/<파일>)
 * @property {() => Promise<void>} [afterChange]  콘텐츠가 바뀐 뒤(배포 훅 호출 등)
 * @property {(nonces: string[]) => Promise<void>} [cleanupUploads]  처리 뒤 업로드 원본 지우기
 * @property {string} [repoRoot]  REPO_FILES를 읽을 폴더(기본 현재 폴더)
 * @property {(...a: unknown[]) => void} [log]
 */

/**
 * 요청 하나를 처리하고 결과 댓글을 남긴다. 실패도 댓글로 남기고 예외를 던지지 않는다.
 * @param {number} number
 * @param {Options} o
 */
export async function processRequest(number, o) {
  const log = o.log ?? (() => {});
  const req = await o.store.getRequest(number);
  if (!req) return;
  const comments = await o.store.listComments(number);
  const dir = mkdtempSync(join(tmpdir(), 'archive-'));
  const input = join(dir, '.archive-input');
  let nonces = [];
  // 되묻는 중이면 답을 받은 뒤 같은 첨부를 다시 읽으므로 지우지 않는다
  let waiting = false;
  try {
    const root = o.repoRoot ?? process.cwd();
    for (const file of REPO_FILES) {
      const from = join(root, file);
      if (!existsSync(from)) continue;
      mkdirSync(join(dir, file, '..'), { recursive: true });
      if (file === 'CLAUDE.md') {
        // 개발용 공동작업 규칙(@AGENTS.md) 연결은 AI 실행에 넘기지 않는다
        writeFileSync(join(dir, file), readFileSync(from, 'utf8').replace(/^@AGENTS\.md\s*$/m, ''));
      } else {
        cpSync(from, join(dir, file));
      }
    }
    await o.store.exportContent(dir);
    mkdirSync(input, { recursive: true });

    // ai.yml과 같은 issue.json: 작성자 글과 질문 댓글만 대화로 넘긴다
    const thread = comments
      .filter((c) => !c.bot || c.body.includes(MARK.question))
      .map((c) => ({ author: c.bot ? 'github-actions[bot]' : 'author', date: c.createdAt, body: c.body }));
    const issue = { title: req.title, body: req.body, date: req.createdAt, route: req.route, comments: thread };
    writeFileSync(join(input, 'issue.json'), JSON.stringify(issue));

    // 첨부: 대화창이 올린 `첨부: upload/<nonce>/<file>` 줄 (작성자 글에서만)
    const refs = uploadRefs({ title: req.title, body: req.body, comments: comments.filter((c) => !c.bot) });
    nonces = [...new Set(refs.map((r) => r.branch.slice('upload/'.length)))];
    const manifest = [];
    for (const ref of refs) {
      let name = null;
      try {
        const bytes = await o.readUpload(ref.branch.slice('upload/'.length), ref.path);
        const ext = bytes && extension(bytes);
        if (ext) {
          name = createHash('sha256').update(bytes).digest('hex') + '.' + ext;
          writeFileSync(join(input, name), bytes);
        }
      } catch {
        name = null;
      }
      manifest.push({ name, url: ref.ref });
    }
    writeFileSync(join(input, 'attachments.json'), JSON.stringify(manifest, null, 2) + '\n');

    log(`#${number} AI 실행 (${req.route})`);
    const result = await o.runAI(dir);
    if (!result || !['ready', 'question', 'unchanged'].includes(result.status) || typeof result.message !== 'string') {
      throw new Error('AI가 정해진 형식으로 답하지 않았어요.');
    }

    if (result.status === 'question') {
      // ai.yml처럼 job·memo의 되묻기는 essay·archive로 이어서 받는다
      if (req.route === 'job') await o.store.setRoute(number, 'essay');
      else if (req.route === 'memo') await o.store.setRoute(number, 'archive');
      await o.store.addComment(number, true, `${MARK.question}\n${result.message}`);
      waiting = true;
      return;
    }
    if (result.status === 'unchanged') {
      await o.store.addComment(number, true, `${result.message}\n${MARK.unchanged}`);
      return;
    }

    // 검증: 기존 ai-content.mjs 규칙(작업 폴더 기준) + 사이트 빌드와 같은 zod 스키마
    let written;
    try {
      writeFileSync(join(input, 'result.json'), JSON.stringify(result));
      written = await applyAt(dir);
      for (const path of written) if (path.startsWith('content/')) checkSchema(path, readFileSync(join(dir, path), 'utf8'));
    } catch (e) {
      log(`  검증 실패: ${e.message}`);
      await o.store.addComment(number, true, `콘텐츠 검증을 통과하지 못해 반영하지 않았어요: ${e.message}\n${MARK.failed}`);
      return;
    }

    // 첨부를 먼저 올리고(공개 URL이 생겨야 항목이 가리킬 수 있다) 콘텐츠를 한 번에 쓴다
    for (const path of written.filter((p) => p.startsWith('public/'))) {
      await o.saveFile(path.slice('public/'.length), readFileSync(join(dir, path)));
    }
    const files = written.filter((p) => p.startsWith('content/')).map((path) => ({ path, markdown: readFileSync(join(dir, path), 'utf8') }));
    if (files.length) await o.store.saveContent(files);
    if (written.length) await o.afterChange?.();
    await o.store.addComment(
      number,
      true,
      `${result.message}\n\n반영한 파일:\n${written.map((f) => `- ${f}`).join('\n') || '- (없음)'}\n${MARK.done}`,
    );
  } catch (e) {
    log(`#${number} 실패: ${e?.message}`);
    await o.store.addComment(number, true, `자동 처리에 실패했어요. ${String(e?.message ?? e).split('\n')[0]}\n${MARK.failed}`).catch(() => {});
  } finally {
    rmSync(dir, { recursive: true, force: true });
    if (nonces.length && !waiting) await o.cleanupUploads?.(nonces).catch(() => {});
  }
}
