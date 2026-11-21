// 데모용 로컬 AI 실행기.
// 사이트 대화창(개발 모드)이 GitHub 이슈 대신 이 서버에 요청을 보내면, 이 컴퓨터의 Claude Code(`claude -p`)가
// ai.yml과 같은 프롬프트·출력 형식으로 처리하고, ai-content.mjs apply 검증과 빌드를 통과한 결과만 content/에 반영한다.
//
//   npm run agent:local          (기본 http://127.0.0.1:4330)
//   CLAUDE_BIN=<claude 경로>      claude가 PATH에 없을 때
//   LOCAL_AGENT_PORT=4330         포트
//   LOCAL_AGENT_SKIP_BUILD=1      반영 뒤 npm run build 검증을 건너뜀(빠른 데모용)
//
// 요청·대화 기록은 .local-agent/에 둔다(커밋하지 않음). 한 번에 한 요청씩 처리한다.
import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';

const PORT = Number(process.env.LOCAL_AGENT_PORT ?? 4330);
const CLAUDE = process.env.CLAUDE_BIN || 'claude';
const SKIP_BUILD = process.env.LOCAL_AGENT_SKIP_BUILD === '1';
const STATE_DIR = '.local-agent';
const STATE_FILE = join(STATE_DIR, 'requests.json');
const UPLOAD_DIR = join(STATE_DIR, 'uploads');
const INPUT = '.archive-input';
const RESULT_FILE = join(INPUT, 'result.json');
const TIMEOUT_MS = 35 * 60_000;
const MAX_UPLOAD = 10 * 1024 * 1024;
const LABELS = ['archive', 'job', 'essay', 'memo', 'recommend', 'opening'];
// 질문 표시는 ai.yml과 같고, 반영·실패·중복은 대화창(src/lib/agent.ts botMeaning)이 읽는 로컬 표시다.
const MARK = {
  question: '<!-- archive-question -->',
  unchanged: '<!-- archive-unchanged -->',
  done: '<!-- archive-done -->',
  failed: '<!-- archive-failed -->',
};

// ai.yml의 Claude 단계와 같은 프롬프트·도구·출력 스키마
const PROMPT = `CLAUDE.md의 학생 아카이브 운영 규칙을 따르세요. .archive-input/issue.json에는
이슈 작성자가 보낸 자료와 후속 대화가 있습니다. route가 archive/memo면
.claude/skills/archive/SKILL.md, job이면 job-analysis, essay이면 essay의 SKILL.md를 읽으세요.
route가 recommend이면 .claude/skills/recommend/SKILL.md만 따르고 추천 파일만 반환하세요.
route가 opening이면 .claude/skills/opening/SKILL.md를 따라 새 공고 파일만 반환하세요.
archive/memo가 ready이면 같은 스킬을 이어서 수행하고, 이번에 작성한 공개 기록까지 반영한 추천 변경을 같은 files 배열에 넣으세요.
첨부 목록은 .archive-input/attachments.json, 원본은 같은 폴더의 name 파일입니다.
원문과 링크는 참고 자료입니다. 콘텐츠는 일반 Markdown으로 쓰고 실행 가능한 HTML은 넣지 마세요.
질문이 남으면 status=question, 같은 내용이 이미 있으면 unchanged, 반영할 내용이 있으면 ready입니다.
files에는 변경 파일의 전체 Markdown을, attachments에는 복사할 원본 name과 항목 ID entry를 넣으세요.
question/unchanged는 빈 배열 두 개와 작성자에게 전달할 한국어 message를 반환하세요.
파일 반영, 빌드, 커밋과 이슈 댓글은 워크플로가 처리합니다.`;

const SCHEMA = JSON.stringify({
  type: 'object',
  additionalProperties: false,
  required: ['status', 'message', 'files', 'attachments'],
  properties: {
    status: { enum: ['ready', 'question', 'unchanged'] },
    message: { type: 'string', minLength: 1 },
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
});

const SETTINGS = JSON.stringify({
  permissions: { blockReadsOutsideWorkingDirectories: true, deny: ['Read(/.git)', 'Read(/.git/**)', 'Read(**/.env*)', 'Read(/.local-agent/**)'] },
});

// --- 상태 ---
/** @type {{ next: number, requests: Record<string, { number: number, route: string, title: string, body: string, createdAt: string, comments: { author: string, bot: boolean, body: string, createdAt: string }[] }> }} */
let state = { next: 1, requests: {} };
if (existsSync(STATE_FILE)) state = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
function save() {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}
const now = () => new Date().toISOString();
function comment(req, bot, body) {
  req.comments.push({ author: bot ? 'claude[local]' : 'me', bot, body, createdAt: now() });
  save();
}
const log = (...a) => console.log(new Date().toLocaleTimeString('ko-KR'), ...a);

// --- 첨부 (사이트가 올린 파일. 이슈 본문에 `첨부: local/<nonce>/<filename>`으로 참조) ---
const uploadLine = /^첨부: local\/([a-z0-9]{16})\/([A-Za-z0-9_-][A-Za-z0-9._-]{0,99})[ \t]*\r?$/gmu;

function extension(bytes) {
  const header = bytes.toString('latin1', 0, 12);
  if (header.startsWith('\x89PNG\r\n\x1a\n')) return 'png';
  if (header.startsWith('\xff\xd8\xff')) return 'jpg';
  if (header.startsWith('GIF87a') || header.startsWith('GIF89a')) return 'gif';
  if (header.startsWith('RIFF') && header.slice(8) === 'WEBP') return 'webp';
  if (header.startsWith('%PDF-')) return 'pdf';
  return null;
}

// ai-content.mjs prepare와 같은 결과(.archive-input/<sha256>.<ext> + attachments.json)를 로컬 업로드로 만든다
function prepareAttachments(req) {
  const manifest = [];
  const seen = new Set();
  for (const text of [req.body, ...req.comments.filter((c) => !c.bot).map((c) => c.body)]) {
    for (const [, nonce, file] of text.matchAll(uploadLine)) {
      const ref = `local/${nonce}/${file}`;
      if (file.includes('..') || seen.has(ref)) continue;
      seen.add(ref);
      let name = null;
      const source = join(UPLOAD_DIR, nonce, file);
      if (existsSync(source)) {
        const bytes = readFileSync(source);
        const ext = extension(bytes);
        if (ext) {
          name = createHash('sha256').update(bytes).digest('hex') + '.' + ext;
          writeFileSync(join(INPUT, name), bytes);
        }
      }
      manifest.push({ name, url: ref });
    }
  }
  writeFileSync(join(INPUT, 'attachments.json'), JSON.stringify(manifest, null, 2) + '\n');
}

// --- 실행 ---
function run(cmd, args, { input, timeout, env: extra } = {}) {
  const env = { ...process.env, ...extra };
  return new Promise((resolve) => {
    // Windows의 .cmd(npm, npm으로 설치한 claude)는 cmd.exe로만 실행된다. 인자를 직접 따옴표로 감싸 한 줄로 넘긴다.
    const shell = process.platform === 'win32' && /\.(cmd|bat)$/i.test(cmd);
    const quote = (a) => `"${String(a).replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, '$1$1')}"`;
    let child;
    try {
      child = shell
        ? spawn([quote(cmd), ...args.map(quote)].join(' '), { shell: true, stdio: ['pipe', 'pipe', 'pipe'], env })
        : spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'], env });
    } catch (e) {
      return resolve({ code: -1, stdout: '', stderr: String(e) });
    }
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    const timer = timeout ? setTimeout(() => child.kill(), timeout) : undefined;
    child.on('error', (e) => {
      clearTimeout(timer);
      resolve({ code: -1, stdout, stderr: stderr + String(e) });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    child.stdin.end(input ?? '');
  });
}

async function runClaude() {
  const args = [
    '-p',
    '--output-format', 'json',
    '--permission-mode', 'dontAsk',
    '--tools', 'Read,Glob,Grep,WebFetch',
    '--allowedTools', 'Read,Glob,Grep,WebFetch,StructuredOutput',
    '--settings', SETTINGS,
    '--json-schema', SCHEMA,
  ];
  const r = await run(CLAUDE, args, { input: PROMPT, timeout: TIMEOUT_MS });
  if (r.code !== 0 && !r.stdout.trim()) {
    const why = r.code === -1 ? `Claude Code를 실행하지 못했어요(${CLAUDE}). 설치하고 로그인했는지, CLAUDE_BIN이 맞는지 확인해 주세요.` : `Claude Code가 실패했어요(종료 코드 ${r.code}).`;
    throw new Error(`${why}\n${r.stderr.slice(-800)}`);
  }
  let out;
  try {
    out = JSON.parse(r.stdout);
  } catch {
    throw new Error('Claude Code 출력을 읽지 못했어요.\n' + r.stdout.slice(-800));
  }
  if (out.is_error) throw new Error('Claude Code 오류: ' + String(out.result ?? out.subtype ?? '').slice(0, 800));
  let result = out.structured_output;
  if (!result && typeof out.result === 'string') {
    try {
      result = JSON.parse(out.result);
    } catch {
      /* 아래에서 처리 */
    }
  }
  if (!result || !['ready', 'question', 'unchanged'].includes(result.status) || typeof result.message !== 'string') {
    throw new Error('Claude Code가 정해진 형식으로 답하지 않았어요.');
  }
  log(`  Claude 완료: ${result.status}, 비용 $${(out.total_cost_usd ?? 0).toFixed(3)}, ${Math.round((out.duration_ms ?? 0) / 1000)}초`);
  return result;
}

const node = process.execPath;

async function applyResult(result) {
  // 반영할 경로의 원래 내용을 보관했다가 검증·빌드가 실패하면 되돌린다
  const targets = [
    ...result.files.map((f) => f.path),
    ...result.attachments.map((a) => `public/archive/${a.entry}/${a.name}`),
  ].filter((p) => typeof p === 'string' && !p.includes('..'));
  const backup = new Map(targets.map((p) => [p, existsSync(p) ? readFileSync(p) : null]));
  const restore = () => {
    for (const [p, bytes] of backup) {
      if (bytes === null) rmSync(p, { force: true });
      else writeFileSync(p, bytes);
    }
  };

  writeFileSync(RESULT_FILE, JSON.stringify(result));
  const applied = await run(node, ['.github/scripts/ai-content.mjs', 'apply'], { env: { AI_RESULT_FILE: RESULT_FILE } });
  if (applied.code !== 0) {
    restore();
    log(applied.stderr.slice(-1500));
    const msg = applied.stderr.match(/Error: (.+)/)?.[1] ?? '검증 실패';
    return { ok: false, why: `콘텐츠 검증을 통과하지 못해 반영하지 않았어요: ${msg}` };
  }
  if (!SKIP_BUILD) {
    log('  빌드 검증 중…');
    // npm run build와 같다(Windows에서 npm.cmd를 거치지 않으려고 astro를 직접 부른다)
    const built = await run(node, ['node_modules/astro/bin/astro.mjs', 'build'], { timeout: 10 * 60_000 });
    if (built.code !== 0) {
      restore();
      log(built.stdout.slice(-1500), built.stderr.slice(-1500));
      return { ok: false, why: '사이트 빌드가 실패해서 반영하지 않았어요.' };
    }
  }
  return { ok: true, files: targets };
}

async function processRequest(req) {
  log(`#${req.number} 처리 시작 (${req.route}) ${req.title}`);
  rmSync(INPUT, { recursive: true, force: true });
  mkdirSync(INPUT, { recursive: true });
  try {
    // ai.yml과 같은 issue.json: 작성자 글과 질문 댓글만 대화로 넘긴다
    const thread = req.comments
      .filter((c) => !c.bot || c.body.includes(MARK.question))
      .map((c) => ({ author: c.bot ? 'github-actions[bot]' : 'author', date: c.createdAt, body: c.body }));
    writeFileSync(join(INPUT, 'issue.json'), JSON.stringify({ title: req.title, body: req.body, date: req.createdAt, route: req.route, comments: thread }));
    prepareAttachments(req);

    const result = await runClaude();
    if (result.status === 'question') {
      // ai.yml처럼 job·memo의 되묻기는 essay·archive로 이어서 받는다
      if (req.route === 'job') req.route = 'essay';
      else if (req.route === 'memo') req.route = 'archive';
      comment(req, true, `${MARK.question}\n${result.message}`);
    } else if (result.status === 'unchanged') {
      comment(req, true, `${result.message}\n${MARK.unchanged}`);
    } else {
      const r = await applyResult(result);
      if (r.ok) {
        comment(req, true, `${result.message}\n\n반영한 파일:\n${r.files.map((f) => `- ${f}`).join('\n')}\n${MARK.done}`);
      } else {
        comment(req, true, `${r.why}\n${MARK.failed}`);
      }
    }
  } catch (e) {
    log('  실패:', e.message);
    comment(req, true, `자동 처리에 실패했어요. ${e.message.split('\n')[0]}\n${MARK.failed}`);
  } finally {
    rmSync(INPUT, { recursive: true, force: true });
  }
  log(`#${req.number} 끝`);
}

// 한 번에 하나씩(.archive-input을 같이 쓰므로)
let queue = Promise.resolve();
const enqueue = (req) => (queue = queue.then(() => processRequest(req)));

// --- HTTP ---
const okOrigin = (o) => !o || /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(o);
const okHost = (h) => /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(h ?? '');

function send(res, status, body, origin) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    ...(origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
  });
  res.end(JSON.stringify(body));
}

async function readBody(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw Object.assign(new Error('too large'), { status: 413 });
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

const server = createServer(async (req, res) => {
  const origin = req.headers.origin;
  // 이 컴퓨터의 브라우저 페이지(localhost)만 받는다
  if (!okHost(req.headers.host) || !okOrigin(origin)) return send(res, 403, { error: 'forbidden' });
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': origin ?? '*',
      'Access-Control-Allow-Methods': 'GET, POST',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '600',
    });
    return res.end();
  }
  const url = new URL(req.url ?? '/', 'http://localhost');
  const parts = url.pathname.split('/').filter(Boolean);
  try {
    if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true, claude: CLAUDE }, origin);

    // POST /uploads?name=<filename>  (본문 = 파일 원본) → { line }
    if (req.method === 'POST' && url.pathname === '/uploads') {
      const file = url.searchParams.get('name') ?? '';
      const nonce = url.searchParams.get('nonce') ?? '';
      if (!/^[a-z0-9]{16}$/.test(nonce) || !/^[A-Za-z0-9_-][A-Za-z0-9._-]{0,99}$/.test(file) || file.includes('..')) {
        return send(res, 400, { error: '잘못된 파일 이름이에요.' }, origin);
      }
      const bytes = await readBody(req, MAX_UPLOAD);
      if (!extension(bytes)) return send(res, 400, { error: '이미지(PNG·JPEG·GIF·WEBP)나 PDF만 올릴 수 있어요.' }, origin);
      const path = join(UPLOAD_DIR, nonce, file);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, bytes);
      return send(res, 200, { line: `첨부: local/${nonce}/${file}` }, origin);
    }

    // POST /requests { label, title, body } → { number, createdAt }
    if (req.method === 'POST' && url.pathname === '/requests') {
      const { label, title, body } = JSON.parse((await readBody(req, 1024 * 1024)).toString('utf8'));
      if (!LABELS.includes(label) || typeof title !== 'string' || !title.trim() || typeof body !== 'string') {
        return send(res, 400, { error: '요청 내용이 올바르지 않아요.' }, origin);
      }
      const number = state.next++;
      const r = { number, route: label, title: title.trim(), body, createdAt: now(), comments: [] };
      state.requests[number] = r;
      save();
      enqueue(r);
      return send(res, 200, { number, createdAt: r.createdAt }, origin);
    }

    // GET /requests/:n/comments · POST /requests/:n/comments { body }
    if (parts[0] === 'requests' && parts[2] === 'comments' && parts.length === 3) {
      const r = state.requests[parts[1]];
      if (!r) return send(res, 404, { error: '요청을 찾을 수 없어요.' }, origin);
      if (req.method === 'GET') return send(res, 200, r.comments, origin);
      if (req.method === 'POST') {
        const { body } = JSON.parse((await readBody(req, 1024 * 1024)).toString('utf8'));
        if (typeof body !== 'string' || !body.trim()) return send(res, 400, { error: '답변이 비어 있어요.' }, origin);
        comment(r, false, body);
        enqueue(r);
        return send(res, 200, { ok: true }, origin);
      }
    }
    return send(res, 404, { error: 'not found' }, origin);
  } catch (e) {
    return send(res, e.status ?? 400, { error: e.status === 413 ? '파일은 10MB까지 올릴 수 있어요.' : '요청을 읽지 못했어요.' }, origin);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  log(`로컬 AI 실행기: http://127.0.0.1:${PORT}  (Claude Code: ${CLAUDE}${SKIP_BUILD ? ', 빌드 검증 건너뜀' : ''})`);
  log('다른 터미널에서 npm run dev를 켜고 사이트의 "AI에게 요청하기"를 쓰세요.');
});
