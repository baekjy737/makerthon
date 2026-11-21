// 발표 데모용 로컬 AI 실행기. 사이트 대화창이 이 서버에 요청을 보내면, 이 컴퓨터의 Claude Code(`claude -p`)가
// 서버(Vercel)와 같은 파이프라인(scripts/agent/pipeline.mjs)으로 처리한다. 검증을 통과한 결과만 반영한다.
//
//   npm run agent:local          (기본 http://127.0.0.1:4330, .env를 읽는다)
//
// 반영할 곳:
//   - .env에 FIREBASE_SERVICE_ACCOUNT(또는 GOOGLE_APPLICATION_CREDENTIALS)가 있으면 Firestore + Vercel Blob(BLOB_READ_WRITE_TOKEN).
//     요청 대화도 Firestore에 남고, VERCEL_DEPLOY_HOOK_URL이 있으면 배포 사이트도 다시 빌드한다.
//   - 없으면 이 저장소의 content/와 public/archive/ 파일(요청 대화는 .local-agent/에).
// 개발 서버(npm run dev)는 반영 뒤 .content-stamp가 바뀌면 콘텐츠를 다시 읽는다.
//
//   CLAUDE_BIN=<claude 경로>      claude가 PATH에 없을 때
//   LOCAL_AGENT_PORT=4330         포트
//   SITE_URL=https://…            배포 사이트에서도 이 실행기를 쓰려면(발표 노트북) 그 주소를 허용한다
import { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { afterChange } from './agent/deploy.mjs';
import { LABELS, extension, processRequest } from './agent/pipeline.mjs';
import { runWithClaudeCode } from './agent/run-claude.mjs';

const PORT = Number(process.env.LOCAL_AGENT_PORT ?? 4330);
const STATE_DIR = '.local-agent';
const STATE_FILE = join(STATE_DIR, 'requests.json');
const UPLOAD_DIR = join(STATE_DIR, 'uploads');
const MAX_UPLOAD = 10 * 1024 * 1024;
const log = (...a) => console.log(new Date().toLocaleTimeString('ko-KR'), ...a);

const useFirebase = !!(process.env.FIREBASE_SERVICE_ACCOUNT?.trim() || process.env.GOOGLE_APPLICATION_CREDENTIALS);

// --- 파일 저장소 (Firebase 없이) ---
let state = { next: 1, requests: {} };
if (existsSync(STATE_FILE)) state = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
function save() {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}
const fileStore = {
  async exportContent(dir) {
    if (existsSync('content')) cpSync('content', join(dir, 'content'), { recursive: true });
  },
  async saveContent(files) {
    for (const { path, markdown } of files) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, markdown);
    }
  },
  async getRequest(n) {
    const r = state.requests[n];
    return r ? { number: r.number, route: r.route, title: r.title, body: r.body, createdAt: r.createdAt } : null;
  },
  async setRoute(n, route) {
    state.requests[n].route = route;
    save();
  },
  async listComments(n) {
    return state.requests[n]?.comments ?? [];
  },
  async addComment(n, bot, body) {
    state.requests[n].comments.push({ author: bot ? 'claude[local]' : 'me', bot, body, createdAt: new Date().toISOString() });
    save();
  },
  async createRequest({ route, title, body }) {
    const number = state.next++;
    const createdAt = new Date().toISOString();
    state.requests[number] = { number, route, title, body, createdAt, comments: [] };
    save();
    return { number, createdAt };
  },
};

const fb = useFirebase ? await import('./agent/firestore.mjs') : null;
const store = fb ? { ...fb.firestoreStore, createRequest: fb.createRequest } : fileStore;
const blob = useFirebase && process.env.BLOB_READ_WRITE_TOKEN ? await import('./agent/blob.mjs') : null;

async function saveFile(path, bytes) {
  if (blob) return blob.saveFile(path, bytes);
  mkdirSync(dirname(join('public', path)), { recursive: true });
  writeFileSync(join('public', path), bytes);
}

// 대화창은 데모 모드에서 첨부를 이 실행기에 올리고 `첨부: upload/<nonce>/<file>`로 가리킨다
async function readUpload(nonce, file) {
  const path = join(UPLOAD_DIR, nonce, file);
  return existsSync(path) ? readFileSync(path) : null;
}
async function cleanupUploads(nonces) {
  for (const n of nonces) rmSync(join(UPLOAD_DIR, n), { recursive: true, force: true });
}

// 한 번에 하나씩 처리한다
let queue = Promise.resolve();
const enqueue = (n) =>
  (queue = queue.then(() =>
    processRequest(n, {
      store,
      runAI: (dir) => runWithClaudeCode(dir, { log }),
      readUpload,
      saveFile,
      cleanupUploads,
      afterChange: () => afterChange({ stamp: true }),
      log,
    }),
  ));

// --- HTTP ---
const siteOrigin = (() => {
  try {
    return process.env.SITE_URL ? new URL(process.env.SITE_URL).origin : null;
  } catch {
    return null;
  }
})();
const okOrigin = (o) => !o || /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(o) || o === siteOrigin;
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
  // 이 컴퓨터의 브라우저 페이지(localhost)와 SITE_URL만 받는다
  if (!okHost(req.headers.host) || !okOrigin(origin)) return send(res, 403, { error: 'forbidden' });
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': origin ?? '*',
      'Access-Control-Allow-Methods': 'GET, POST',
      'Access-Control-Allow-Headers': 'Content-Type',
      // 배포 사이트(https)에서 이 컴퓨터(127.0.0.1)로 보내는 요청을 브라우저가 허용하도록
      'Access-Control-Allow-Private-Network': 'true',
      'Access-Control-Max-Age': '600',
    });
    return res.end();
  }
  const url = new URL(req.url ?? '/', 'http://localhost');
  const parts = url.pathname.split('/').filter(Boolean);
  try {
    if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true }, origin);

    // POST /uploads?nonce=<16자>&name=<filename>  (본문 = 파일 원본) → { line }
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
      return send(res, 200, { line: `첨부: upload/${nonce}/${file}` }, origin);
    }

    // POST /requests { label, title, body } → { number, createdAt }
    if (req.method === 'POST' && url.pathname === '/requests') {
      const { label, title, body } = JSON.parse((await readBody(req, 1024 * 1024)).toString('utf8'));
      if (!LABELS.includes(label) || typeof title !== 'string' || !title.trim() || typeof body !== 'string') {
        return send(res, 400, { error: '요청 내용이 올바르지 않아요.' }, origin);
      }
      const r = await store.createRequest({ route: label, title: title.trim(), body });
      log(`#${r.number} 받음 (${label}) ${title.trim()}`);
      enqueue(r.number);
      return send(res, 200, { number: r.number, createdAt: r.createdAt }, origin);
    }

    // GET /requests/:n/comments · POST /requests/:n/comments { body }
    if (parts[0] === 'requests' && parts[2] === 'comments' && parts.length === 3) {
      const n = Number(parts[1]);
      if (!Number.isInteger(n) || !(await store.getRequest(n))) return send(res, 404, { error: '요청을 찾을 수 없어요.' }, origin);
      if (req.method === 'GET') return send(res, 200, await store.listComments(n), origin);
      if (req.method === 'POST') {
        const { body } = JSON.parse((await readBody(req, 1024 * 1024)).toString('utf8'));
        if (typeof body !== 'string' || !body.trim()) return send(res, 400, { error: '답변이 비어 있어요.' }, origin);
        await store.addComment(n, false, body);
        enqueue(n);
        return send(res, 200, { ok: true }, origin);
      }
    }
    return send(res, 404, { error: 'not found' }, origin);
  } catch (e) {
    return send(res, e.status ?? 400, { error: e.status === 413 ? '파일은 10MB까지 올릴 수 있어요.' : '요청을 읽지 못했어요.' }, origin);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  log(`로컬 AI 실행기: http://127.0.0.1:${PORT}  (Claude Code: ${process.env.CLAUDE_BIN || 'claude'})`);
  log(useFirebase ? `반영할 곳: Firestore${blob ? ' + Vercel Blob' : ''}` : '반영할 곳: 이 저장소의 content/ 파일');
  log('다른 터미널에서 npm run dev를 켜고 사이트의 "AI에게 요청하기"를 쓰세요.');
});
