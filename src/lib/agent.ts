// 사이트 안 AI 요청(웹 에이전트)용 GitHub 클라이언트.
// AI 실행은 Actions(ai.yml)가 하고, 브라우저는 학생의 fine-grained PAT로 이슈·댓글·업로드 브랜치만 다룬다.
import { issueUrl, type IssueLabel, type IssueOptions } from './issue';

/** localStorage: PAT */
export const TOKEN_KEY = 'agent-token';
/** localStorage: 최근 요청 [{ number, title, createdAt }] (최신 5개) */
export const RECENT_KEY = 'agent-recent';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const UPLOAD_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf'] as const;
/** 진행 확인 간격 */
export const POLL_MS = 10_000;
/** working이 이만큼 이어지면 "응답이 늦어요" (ai.yml 제한 35분) */
export const SLOW_MS = 40 * 60_000;

const LABELS: readonly IssueLabel[] = ['archive', 'job', 'essay', 'memo', 'recommend', 'opening'];
const API = 'https://api.github.com';

export type AgentStatus = 'working' | 'question' | 'done' | 'failed';

export interface Comment {
  author: string;
  bot: boolean;
  body: string;
  createdAt: string;
}

export interface RecentRequest {
  number: number;
  title: string;
  createdAt: string;
}

/** `https://github.com/<repo>/issues/new?labels=…&title=…&body=…`만 읽는다. 다른 저장소·모르는 라벨이면 null */
export function parseIssueUrl(href: string, repo: string): IssueOptions | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.origin !== 'https://github.com' || url.pathname !== `/${repo}/issues/new`) return null;
  const label = url.searchParams.get('labels');
  if (!label || !LABELS.includes(label as IssueLabel)) return null;
  return { label: label as IssueLabel, title: url.searchParams.get('title') ?? '', body: url.searchParams.get('body') ?? '' };
}

/**
 * 업로드 파일명: `[A-Za-z0-9_-][A-Za-z0-9._-]{0,99}`. 확장자는 소문자로 두고,
 * 허용 밖 문자 묶음은 `-`로 바꾸고, 앞뒤의 `-`·`.`를 지우고, 비면 `file-<index+1>`, 전체 100자.
 */
export function safeFilename(name: string, index: number): string {
  const m = name.match(/\.([A-Za-z0-9]{1,10})$/);
  const ext = m ? m[1].toLowerCase() : '';
  const tail = ext ? `.${ext}` : '';
  const trim = (s: string) => s.replace(/^[-.]+|[-.]+$/g, '');
  let base = trim(
    (m ? name.slice(0, -m[0].length) : name)
      .replace(/[^A-Za-z0-9._-]+/g, '-')
      .replace(/\.{2,}/g, '.'),
  );
  if (!base) base = `file-${index + 1}`;
  base = trim(base.slice(0, 100 - tail.length)) || `file-${index + 1}`;
  return base + tail;
}

/** 업로드 브랜치용 무작위 16자(소문자·숫자) */
export function newNonce(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => chars[b % chars.length]).join('');
}

/** 이슈 본문에 넣는 첨부 참조 한 줄. ai-content.mjs prepare가 이 형식만 받는다 */
export const uploadLine = (nonce: string, filename: string) => `첨부: upload/${nonce}/${filename}`;

type Meaning = AgentStatus | null;

/** 봇 댓글의 의미. 표에 없는 봇 댓글(배포 안내 등)은 null */
function botMeaning(body: string): Meaning {
  if (body.includes('<!-- archive-question -->')) return 'question';
  // 로컬 실행기(scripts/local-agent.mjs)의 표시
  if (body.includes('<!-- archive-failed -->')) return 'failed';
  if (body.includes('<!-- archive-done -->')) return 'done';
  if (body.includes('자동 처리에 실패') || body.includes('반영하지 않았어요')) return 'failed';
  if (/PR #\d+/.test(body) && body.includes('병합')) return 'done';
  if (body.includes('이미 같은 내용이 기록되어 있어요') || body.includes('<!-- archive-unchanged -->')) return 'done';
  return null;
}

/**
 * 댓글만 보고 진행 상태를 정한다. 마지막 의미 있는 댓글(표의 봇 댓글 또는 작성자 댓글)로 판정한다.
 * 작성자 댓글이 마지막이면 다시 처리 중(working). slow는 working일 때만, 마지막 작성자 댓글(없으면 since)부터 40분.
 */
export function issueStatus(comments: Comment[], since: string, now: Date): { status: AgentStatus; slow: boolean } {
  const sorted = [...comments].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  let status: AgentStatus = 'working';
  let base = since;
  for (const c of sorted) {
    if (!c.bot) {
      status = 'working';
      base = c.createdAt;
      continue;
    }
    const meaning = botMeaning(c.body);
    if (meaning) status = meaning;
  }
  const slow = status === 'working' && now.getTime() - Date.parse(base) > SLOW_MS;
  return { status, slow };
}

export class GitHubError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'GitHubError';
    this.status = status;
  }
}

/** GitHub API 실패 안내(한국어). 401·403·404는 토큰 문제로 본다 */
export function githubError(status: number): string {
  switch (status) {
    case 0:
      return 'GitHub에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.';
    case 401:
      return '토큰이 맞지 않거나 만료됐어요. 토큰을 확인해 주세요.';
    case 403:
      return '이 토큰으로는 할 수 없는 요청이에요. 토큰에 이 저장소의 Issues·Contents 읽기·쓰기 권한이 있는지 확인해 주세요.';
    case 404:
      return '저장소를 찾을 수 없어요. 토큰이 이 저장소에 접근할 수 있는지 확인해 주세요.';
    case 422:
      return 'GitHub가 요청 내용을 받지 않았어요. 잠시 뒤 다시 시도해 주세요.';
    default:
      return `GitHub 요청이 실패했어요(${status}). 잠시 뒤 다시 시도해 주세요.`;
  }
}

async function toBase64(file: Blob): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** 학생 PAT로 이 저장소의 이슈·댓글·업로드 브랜치를 다룬다. 실패하면 GitHubError */
export function createClient(repo: string, token: string) {
  async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${API}/repos/${repo}/${path}`, {
        method: init.method ?? 'GET',
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          Authorization: `Bearer ${token}`,
          ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      });
    } catch {
      throw new GitHubError(githubError(0), 0);
    }
    if (!res.ok) throw new GitHubError(githubError(res.status), res.status);
    return (res.status === 204 ? undefined : await res.json()) as T;
  }

  return {
    /** 새 브랜치 upload/<nonce>에 파일을 올리고 이슈 본문에 넣을 참조 줄을 돌려준다. 하나라도 형식·크기가 안 맞으면 요청 전에 실패 */
    async uploadFiles(files: File[]): Promise<string[]> {
      if (files.length === 0) return [];
      for (const f of files) {
        if (f.size > MAX_UPLOAD_BYTES) throw new Error(`파일은 10MB까지 올릴 수 있어요: ${f.name}`);
        if (!(UPLOAD_TYPES as readonly string[]).includes(f.type)) throw new Error(`이미지(PNG·JPEG·GIF·WEBP)나 PDF만 올릴 수 있어요: ${f.name}`);
      }
      const nonce = newNonce();
      const branch = `upload/${nonce}`;
      const main = await call<{ object: { sha: string } }>('git/ref/heads/main');
      await call('git/refs', { method: 'POST', body: { ref: `refs/heads/${branch}`, sha: main.object.sha } });
      const used = new Set<string>();
      const lines: string[] = [];
      for (const [i, f] of files.entries()) {
        let name = safeFilename(f.name, i);
        if (used.has(name)) name = `${i}-${name}`.slice(0, 100);
        used.add(name);
        await call(`contents/${name}`, { method: 'PUT', body: { message: 'chore: 첨부 업로드', branch, content: await toBase64(f) } });
        lines.push(uploadLine(nonce, name));
      }
      return lines;
    },

    async createIssue(o: IssueOptions): Promise<{ number: number; url: string; createdAt: string }> {
      const r = await call<{ number: number; html_url: string; created_at: string }>('issues', {
        method: 'POST',
        body: { title: o.title, body: o.body, labels: [o.label] },
      });
      return { number: r.number, url: r.html_url, createdAt: r.created_at };
    },

    async comments(n: number): Promise<Comment[]> {
      const r = await call<{ user: { login: string; type: string } | null; body: string | null; created_at: string }[]>(
        `issues/${n}/comments?per_page=100`,
      );
      return r.map((c) => ({ author: c.user?.login ?? '', bot: c.user?.type === 'Bot', body: c.body ?? '', createdAt: c.created_at }));
    },

    async reply(n: number, body: string): Promise<void> {
      await call(`issues/${n}/comments`, { method: 'POST', body: { body } });
    },
  };
}

export type AgentClient = ReturnType<typeof createClient>;

/** 개발 모드에서 찾는 로컬 AI 실행기(scripts/local-agent.mjs) 기본 주소 */
export const LOCAL_AGENT_URL = 'http://127.0.0.1:4330';
/** localStorage: 로컬 실행기로 보낸 최근 요청(GitHub 이슈 번호와 섞이지 않게 따로 둔다) */
export const LOCAL_RECENT_KEY = 'agent-recent-local';

/** 로컬 실행기가 켜져 있으면 true. 1초 안에 답이 없으면 false */
export async function localAgentAlive(base: string): Promise<boolean> {
  try {
    const r = await fetch(`${base}/health`, { signal: AbortSignal.timeout(1000) });
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * 데모용: GitHub 대신 이 컴퓨터의 로컬 실행기와 이야기하는 클라이언트. createClient와 같은 모양이다.
 * 로컬 실행기는 이 컴퓨터의 Claude Code로 처리하고 content/에 바로 반영한다.
 */
export function createLocalClient(base: string): AgentClient {
  async function call<T>(path: string, init: { method?: string; body?: BodyInit; json?: unknown } = {}): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${base}${path}`, {
        method: init.method ?? 'GET',
        headers: init.json !== undefined ? { 'Content-Type': 'application/json' } : undefined,
        body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
      });
    } catch {
      throw new GitHubError('로컬 AI 실행기에 연결하지 못했어요. 터미널에서 npm run agent:local이 켜져 있는지 확인해 주세요.', 0);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new GitHubError(data?.error ?? `로컬 AI 실행기 요청이 실패했어요(${res.status}).`, res.status);
    return data as T;
  }

  return {
    async uploadFiles(files: File[]): Promise<string[]> {
      for (const f of files) {
        if (f.size > MAX_UPLOAD_BYTES) throw new Error(`파일은 10MB까지 올릴 수 있어요: ${f.name}`);
        if (!(UPLOAD_TYPES as readonly string[]).includes(f.type)) throw new Error(`이미지(PNG·JPEG·GIF·WEBP)나 PDF만 올릴 수 있어요: ${f.name}`);
      }
      const nonce = newNonce();
      const used = new Set<string>();
      const lines: string[] = [];
      for (const [i, f] of files.entries()) {
        let name = safeFilename(f.name, i);
        if (used.has(name)) name = `${i}-${name}`.slice(0, 100);
        used.add(name);
        const r = await call<{ line: string }>(`/uploads?nonce=${nonce}&name=${encodeURIComponent(name)}`, { method: 'POST', body: f });
        lines.push(r.line);
      }
      return lines;
    },
    async createIssue(o: IssueOptions) {
      const r = await call<{ number: number; createdAt: string }>('/requests', { method: 'POST', json: { label: o.label, title: o.title, body: o.body } });
      return { number: r.number, url: `${base}/requests/${r.number}/comments`, createdAt: r.createdAt };
    },
    async comments(n: number): Promise<Comment[]> {
      return call<Comment[]>(`/requests/${n}/comments`);
    },
    async reply(n: number, body: string): Promise<void> {
      await call(`/requests/${n}/comments`, { method: 'POST', json: { body } });
    },
  };
}

/** localStorage: 서버(Vercel + Firebase)로 보낸 최근 요청 */
export const SERVER_RECENT_KEY = 'agent-recent-server';

/** 서버 모드 첨부 참조 줄. pipeline이 `첨부: upload/<nonce>/<파일>`을 Blob uploads/<nonce>/<파일>에서 읽는다 */
export const uploadPath = (nonce: string, filename: string) => `uploads/${nonce}/${filename}`;

/**
 * Vercel 함수(/api/agent/*)와 이야기하는 클라이언트. createClient와 같은 모양이다.
 * 주인 로그인(Firebase ID 토큰)을 Authorization 헤더로 보내고, 첨부는 Vercel Blob에 브라우저가 직접 올린다.
 * @param base 사이트 기준 경로(import.meta.env.BASE_URL)
 */
export function createServerClient(base: string, getToken: () => Promise<string>): AgentClient {
  const root = base.endsWith('/') ? base : `${base}/`;
  async function call<T>(path: string, init: { method?: string; json?: unknown } = {}): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${root}api/agent/${path}`, {
        method: init.method ?? 'GET',
        headers: {
          Authorization: `Bearer ${await getToken()}`,
          ...(init.json !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
      });
    } catch (e) {
      throw new GitHubError(e instanceof Error && e.message === '로그인이 필요해요.' ? e.message : '서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.', 0);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new GitHubError(data?.error ?? `요청이 실패했어요(${res.status}).`, res.status);
    return data as T;
  }

  return {
    async uploadFiles(files: File[]): Promise<string[]> {
      for (const f of files) {
        if (f.size > MAX_UPLOAD_BYTES) throw new Error(`파일은 10MB까지 올릴 수 있어요: ${f.name}`);
        if (!(UPLOAD_TYPES as readonly string[]).includes(f.type)) throw new Error(`이미지(PNG·JPEG·GIF·WEBP)나 PDF만 올릴 수 있어요: ${f.name}`);
      }
      if (files.length === 0) return [];
      const { upload } = await import('@vercel/blob/client');
      const nonce = newNonce();
      const used = new Set<string>();
      const lines: string[] = [];
      for (const [i, f] of files.entries()) {
        let name = safeFilename(f.name, i);
        if (used.has(name)) name = `${i}-${name}`.slice(0, 100);
        used.add(name);
        try {
          await upload(uploadPath(nonce, name), f, {
            access: 'public',
            handleUploadUrl: `${root}api/agent/upload`,
            headers: { Authorization: `Bearer ${await getToken()}` },
          });
        } catch {
          throw new GitHubError(`첨부를 올리지 못했어요: ${f.name}`, 0);
        }
        lines.push(uploadLine(nonce, name));
      }
      return lines;
    },
    async createIssue(o: IssueOptions) {
      const r = await call<{ number: number; createdAt: string }>('requests', { method: 'POST', json: { label: o.label, title: o.title, body: o.body } });
      return { number: r.number, url: '', createdAt: r.createdAt };
    },
    async comments(n: number): Promise<Comment[]> {
      return call<Comment[]>(`requests/${n}/comments`);
    },
    async reply(n: number, body: string): Promise<void> {
      await call(`requests/${n}/comments`, { method: 'POST', json: { body } });
    },
  };
}

/** 서버 AI가 준비돼 있는지(/api/agent/status). 정적 배포(GitHub Pages)면 false */
export async function serverAgentReady(base: string): Promise<boolean> {
  const root = base.endsWith('/') ? base : `${base}/`;
  try {
    const r = await fetch(`${root}api/agent/status`, { signal: AbortSignal.timeout(3000) });
    return r.ok && (await r.json())?.ready === true;
  } catch {
    return false;
  }
}

/** localStorage 읽기·쓰기. 시크릿 창 등에서 막혀 있으면 읽기는 null(토큰 없음으로 취급), 쓰기는 false */
export function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocal(key: string, value: string | null): boolean {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** 사이트 안에서 바로 요청할 수 있는지(대화창이 있고 토큰이 저장돼 있는지) */
export function canRequestHere(): boolean {
  return !!document.querySelector('[data-agent-dialog]') && !!readLocal(TOKEN_KEY);
}

/** 이슈 작성 진입점: 대화창이 있으면 대화창으로, 없으면 기존처럼 이슈 작성 URL을 새 탭으로 */
export function openIssue(repo: string, o: IssueOptions): void {
  if (document.querySelector('[data-agent-dialog]')) {
    window.dispatchEvent(new CustomEvent('agent:open', { detail: o }));
  } else {
    window.open(issueUrl(repo, o), '_blank', 'noopener');
  }
}
