// 비밀값 두 개(Firebase 서비스 계정 키, Anthropic API 키)를 .env와 Vercel 환경 변수(Sensitive)에 넣는다.
// 값은 화면에 출력하지 않는다. 직접 실행한다:
//   node scripts/setup-secrets.mjs [서비스 계정 JSON 경로]
// 경로를 안 주면 다운로드 폴더에서 가장 최근의 *firebase-adminsdk*.json을 쓴다.
// 이미 있는 Vercel 변수는 그대로 두고 알려 준다(바꾸려면 Vercel 설정 화면에서 지우고 다시 실행).
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

function findKeyFile() {
  if (process.argv[2]) return process.argv[2];
  const dir = join(homedir(), 'Downloads');
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir)
    .filter((f) => /firebase-adminsdk.*\.json$/i.test(f))
    .map((f) => join(dir, f))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return files[0] ?? null;
}

/** 입력을 화면에 보이지 않게 받는다 */
function askHidden(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    let value = '';
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          stdin.setRawMode?.(false);
          stdin.pause();
          stdin.off('data', onData);
          process.stdout.write('\n');
          return resolve(value.trim());
        }
        if (ch === '\u0003') process.exit(1);
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1);
        else value += ch;
      }
    };
    stdin.on('data', onData);
  });
}

function setDotenv(name, value) {
  const path = '.env';
  const lines = existsSync(path) ? readFileSync(path, 'utf8').split(/\r?\n/) : [];
  const line = `${name}=${value}`;
  const i = lines.findIndex((l) => l.startsWith(`${name}=`));
  if (i >= 0) lines[i] = line;
  else lines.push(line);
  writeFileSync(path, lines.join('\n').replace(/\n*$/, '\n'));
}

function addVercel(name, value) {
  for (const env of ['production', 'preview']) {
    const r = spawnSync('vercel', ['env', 'add', name, '--environment', env, '--sensitive', '--yes'], {
      input: value,
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });
    const out = `${r.stdout}${r.stderr}`;
    if (/Added/.test(out)) console.log(`  Vercel ${env}: ${name} 추가`);
    else if (/already exists/i.test(out)) console.log(`  Vercel ${env}: ${name} 이미 있음(그대로 둠)`);
    else {
      // 값이 섞여 나오지 않도록 값이 들어간 줄은 빼고 보여 준다
      const why = out
        .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
        .split('\n')
        .filter((l) => l.trim() && !l.includes(value.slice(0, 20)) && !/DeprecationWarning|trace-deprecation/.test(l))
        .slice(-6)
        .join('\n    ');
      console.log(`  Vercel ${env}: ${name} 추가 실패 (종료 코드 ${r.status ?? r.error?.code})\n    ${why || '출력 없음'}`);
    }
  }
}

// 1. Firebase 서비스 계정 키
const keyFile = findKeyFile();
if (!keyFile || !existsSync(keyFile)) {
  console.log('서비스 계정 JSON을 찾지 못했어요. Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → "새 비공개 키 생성"으로 받은 뒤 다시 실행하세요.');
  process.exit(1);
}
let account;
try {
  account = JSON.parse(readFileSync(keyFile, 'utf8'));
} catch {
  console.log(`JSON을 읽지 못했어요: ${keyFile}`);
  process.exit(1);
}
if (account.type !== 'service_account' || !account.private_key) {
  console.log(`서비스 계정 키 파일이 아니에요: ${keyFile}`);
  process.exit(1);
}
console.log(`서비스 계정 키: ${keyFile} (프로젝트 ${account.project_id})`);
const oneLine = JSON.stringify(account);
setDotenv('FIREBASE_SERVICE_ACCOUNT', oneLine);
console.log('  .env: FIREBASE_SERVICE_ACCOUNT 저장');
addVercel('FIREBASE_SERVICE_ACCOUNT', oneLine);

// 2. Anthropic API 키
const apiKey = await askHidden('Anthropic API 키를 붙여 넣고 Enter (화면에 안 보여요, 건너뛰려면 그냥 Enter): ');
if (apiKey) {
  if (!/^sk-ant-/.test(apiKey)) console.log('  sk-ant-로 시작하지 않아요. 맞는 키인지 확인해 주세요(그래도 저장합니다).');
  setDotenv('ANTHROPIC_API_KEY', apiKey);
  console.log('  .env: ANTHROPIC_API_KEY 저장');
  addVercel('ANTHROPIC_API_KEY', apiKey);
} else {
  console.log('  Anthropic API 키는 건너뛰었어요. 서버 AI는 키를 넣기 전까지 꺼져 있어요.');
}

console.log('\n끝났어요. 받은 JSON 파일은 지워도 됩니다(값은 .env와 Vercel에 들어갔어요).');
