// 이 컴퓨터의 Claude Code(`claude -p`)로 AI를 돌린다(발표 데모용, npm run agent:local).
// ai.yml과 같은 도구·권한(읽기 전용 + WebFetch)과 출력 스키마를 쓴다.
import { spawn } from 'node:child_process';
import { PROMPT, RESULT_SCHEMA } from './pipeline.mjs';

const TIMEOUT_MS = 35 * 60_000;

const SETTINGS = JSON.stringify({
  permissions: { blockReadsOutsideWorkingDirectories: true, deny: ['Read(**/.env*)'] },
});

export function run(cmd, args, { input, timeout, env: extra, cwd } = {}) {
  const env = { ...process.env, ...extra };
  return new Promise((resolve) => {
    // Windows의 .cmd(npm, npm으로 설치한 claude)는 cmd.exe로만 실행된다. 인자를 직접 따옴표로 감싸 한 줄로 넘긴다.
    const shell = process.platform === 'win32' && /\.(cmd|bat)$/i.test(cmd);
    const quote = (a) => `"${String(a).replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, '$1$1')}"`;
    let child;
    try {
      child = shell
        ? spawn([quote(cmd), ...args.map(quote)].join(' '), { shell: true, stdio: ['pipe', 'pipe', 'pipe'], env, cwd })
        : spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'], env, cwd });
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

/**
 * 작업 폴더 dir(cwd)에서 Claude Code를 실행해 RESULT_SCHEMA 모양의 결과를 돌려준다.
 * @param {string} dir
 * @param {{ claude?: string, log?: (...a: unknown[]) => void }} [o]
 */
export async function runWithClaudeCode(dir, o = {}) {
  const claude = o.claude ?? (process.env.CLAUDE_BIN || 'claude');
  const args = [
    '-p',
    '--output-format', 'json',
    '--permission-mode', 'dontAsk',
    '--tools', 'Read,Glob,Grep,WebFetch',
    '--allowedTools', 'Read,Glob,Grep,WebFetch,StructuredOutput',
    '--settings', SETTINGS,
    '--json-schema', JSON.stringify(RESULT_SCHEMA),
  ];
  const r = await run(claude, args, { input: PROMPT, timeout: TIMEOUT_MS, cwd: dir });
  if (r.code !== 0 && !r.stdout.trim()) {
    const why = r.code === -1
      ? `Claude Code를 실행하지 못했어요(${claude}). 설치하고 로그인했는지, CLAUDE_BIN이 맞는지 확인해 주세요.`
      : `Claude Code가 실패했어요(종료 코드 ${r.code}).`;
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
      /* 파이프라인이 형식 오류로 처리한다 */
    }
  }
  o.log?.(`  Claude Code 완료: ${result?.status}, 비용 $${(out.total_cost_usd ?? 0).toFixed(3)}, ${Math.round((out.duration_ms ?? 0) / 1000)}초`);
  return result;
}
