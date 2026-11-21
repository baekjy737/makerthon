import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const input = '.archive-input';
const manifestPath = input + '/attachments.json';
const slug = '[a-z0-9]+(?:-[a-z0-9]+)*';
const entryPattern = new RegExp('^content/entries/' + slug + '(?:/' + slug + ')*\\.md$');
const applicationPattern = new RegExp('^content/applications/' + slug + '/(?:index|essay-[1-9][0-9]*)\\.md$');
const nextPattern = new RegExp('^content/next/' + slug + '\\.md$');
const matchPattern = new RegExp('^content/matches/' + slug + '\\.md$');
const openingPattern = new RegExp('^content/openings/[0-9]{4}-(?:0[1-9]|1[0-2])-' + slug + '\\.md$');
const maxBytes = 25 * 1024 * 1024;

/** @param {string} path @returns {'entry' | 'application' | 'next' | 'match' | 'opening' | null} */
export function contentPath(path) {
  if (typeof path !== 'string') return null;
  if (entryPattern.test(path)) return 'entry';
  if (applicationPattern.test(path)) return 'application';
  if (nextPattern.test(path)) return 'next';
  if (matchPattern.test(path)) return 'match';
  if (openingPattern.test(path)) return 'opening';
  return null;
}

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

// Call with a validated repository-relative path, before reading or replacing it.
function checkFile(path) {
  let current = '';
  for (const part of path.split('/')) {
    check(part && part !== '.' && part !== '..', '잘못된 파일 경로입니다.');
    current = current ? current + '/' + part : part;
    const stat = lstatSync(current, { throwIfNoEntry: false });
    if (stat) {
      check(current === path ? stat.isFile() : stat.isDirectory(), '허용되지 않는 파일 또는 디렉터리입니다.');
    }
  }
}

function attachmentUrls(issue) {
  const urls = new Set();
  for (const text of [issue.title, issue.body, ...issue.comments.map(comment => comment.body)]) {
    for (const [raw] of text.matchAll(/https:\/\/github\.com\/user-attachments\/[^\s<>"'`()[\]]+/gu)) {
      const url = raw.replace(/[.,;!]+$/, '');
      const path = new URL(url).pathname;
      const asset = /^\/user-attachments\/assets\/[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(path);
      const file = /^\/user-attachments\/files\/\d+\/[^/]+$/u.test(path) && !/%(?:2f|5c)/i.test(path);
      if ((asset || file) && !/[?#\\]/u.test(url)) urls.add(url);
    }
  }
  return urls;
}

const uploadLinePattern = /^첨부: (upload\/([a-z0-9]{16})\/([A-Za-z0-9_-][A-Za-z0-9._-]{0,99}))[ \t]*\r?$/gmu;

/**
 * 사이트 대화창이 이슈 본문·댓글에 넣는 업로드 브랜치 첨부 참조(`첨부: upload/<nonce>/<filename>`)를 읽는다.
 * 줄 전체가 이 형식이어야 하고, `..`가 들어간 파일명은 거른다. 같은 참조는 한 번만.
 * @param {{ title: string, body: string, comments: { body: string }[] }} issue
 * @returns {{ branch: string, path: string, ref: string }[]}
 */
export function uploadRefs(issue) {
  const refs = new Map();
  for (const text of [issue.title, issue.body, ...issue.comments.map(comment => comment.body)]) {
    for (const [, ref, nonce, path] of (text ?? '').matchAll(uploadLinePattern)) {
      if (path.includes('..') || refs.has(ref)) continue;
      refs.set(ref, { branch: 'upload/' + nonce, path, ref });
    }
  }
  return [...refs.values()];
}

function extension(bytes) {
  const header = bytes.toString('latin1', 0, 12);
  if (header.startsWith('\x89PNG\r\n\x1a\n')) return 'png';
  if (header.startsWith('\xff\xd8\xff')) return 'jpg';
  if (header.startsWith('GIF87a') || header.startsWith('GIF89a')) return 'gif';
  if (header.startsWith('RIFF') && header.slice(8) === 'WEBP') return 'webp';
  if (header.startsWith('%PDF-')) return 'pdf';
  throw new Error('지원하는 이미지 또는 PDF 형식을 확인할 수 없습니다.');
}

function filename(bytes) {
  return createHash('sha256').update(bytes).digest('hex') + '.' + extension(bytes);
}

function isStorageUrl(url) {
  const host = url.hostname;
  return url.protocol === 'https:' && !url.username && !url.password && !url.port
    && (host === 'github.com' || host.endsWith('.githubusercontent.com')
      || host.endsWith('.blob.core.windows.net') || /^github-[a-z0-9-]+\.s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com$/.test(host));
}

async function download(source) {
  let url = new URL(source);
  const signal = AbortSignal.timeout(60000);
  for (let hop = 0; hop <= 5; hop++) {
    const headers = {};
    if (hop === 0 && url.origin === 'https://github.com' && process.env.GH_TOKEN) {
      headers.Authorization = 'Bearer ' + process.env.GH_TOKEN;
    }
    const response = await fetch(url, { headers, redirect: 'manual', signal });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel();
      const location = response.headers.get('location');
      check(location, '첨부 리디렉션 주소가 없습니다.');
      url = new URL(location, url);
      check(isStorageUrl(url), '지원하지 않는 첨부 저장소입니다.');
      continue;
    }
    check(response.ok && response.body, 'GitHub 첨부를 읽을 수 없습니다.');
    return readLimited(response.body);
  }
  throw new Error('첨부 리디렉션이 너무 많습니다.');
}

async function readLimited(body) {
  const chunks = [];
  let size = 0;
  for await (const chunk of body) {
    size += chunk.length;
    check(size <= maxBytes, '첨부가 GitHub 문서 파일 크기 제한을 초과합니다.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, size);
}

/** 자기 저장소(GH_REPO)의 업로드 브랜치에서 파일 원본을 워크플로 토큰으로 받는다. 리디렉션은 따라가지 않는다. */
async function downloadUpload({ branch, path }) {
  const url = 'https://api.github.com/repos/' + process.env.GH_REPO + '/contents/' + path + '?ref=' + encodeURIComponent(branch);
  const headers = { Accept: 'application/vnd.github.raw', 'X-GitHub-Api-Version': '2022-11-28' };
  if (process.env.GH_TOKEN) headers.Authorization = 'Bearer ' + process.env.GH_TOKEN;
  const response = await fetch(url, { headers, redirect: 'manual', signal: AbortSignal.timeout(60000) });
  check(response.ok && response.body, '업로드한 첨부를 읽을 수 없습니다.');
  return readLimited(response.body);
}

function signedImageUrl(original, signedImages) {
  const asset = new URL(original).pathname.match(/^\/user-attachments\/assets\/([^/]+)$/i);
  const candidate = asset && signedImages[asset[1].toLowerCase()];
  if (!candidate || !URL.canParse(candidate)) return null;
  const url = new URL(candidate);
  if (url.origin !== 'https://private-user-images.githubusercontent.com' || url.username || url.password
    || url.pathname === '/' || !url.search) return null;
  return url;
}

async function prepare() {
  checkFile(input + '/issue.json');
  checkFile(manifestPath);
  const issue = readJson(input + '/issue.json');
  const signedImages = process.env.AI_SIGNED_IMAGES_FILE ? readJson(process.env.AI_SIGNED_IMAGES_FILE) : {};
  const manifest = [];
  for (const url of attachmentUrls(issue)) {
    let name = null;
    for (const source of [url, signedImageUrl(url, signedImages)].filter(Boolean)) {
      let bytes;
      try {
        bytes = await download(source);
        name = filename(bytes);
      } catch {
        continue;
      }
      const path = join(input, name);
      checkFile(path);
      writeFileSync(path, bytes);
      break;
    }
    manifest.push({ name, url });
  }
  // 사이트 대화창이 올린 업로드 브랜치 첨부. 저장소 이름이 이상하면 모두 건너뛴다.
  const refs = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(process.env.GH_REPO ?? '') ? uploadRefs(issue) : [];
  for (const ref of refs) {
    let name = null;
    try {
      const bytes = await downloadUpload(ref);
      name = filename(bytes);
      const path = join(input, name);
      checkFile(path);
      writeFileSync(path, bytes);
    } catch {
      name = null;
    }
    manifest.push({ name, url: ref.ref });
  }
  // 반영이 끝나면 ai.yml이 이 브랜치들을 지운다(작업 폴더 밖 파일이라 브랜치를 바꿔도 남는다)
  if (process.env.AI_UPLOAD_BRANCHES_FILE) {
    const branches = [...new Set(refs.map(ref => ref.branch))];
    writeFileSync(process.env.AI_UPLOAD_BRANCHES_FILE, branches.map(branch => branch + '\n').join(''));
  }
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
}

function frontmatter(markdown, parse) {
  const block = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(markdown);
  check(block, '콘텐츠 파일의 frontmatter가 없습니다.');
  const data = parse(block[1]);
  check(data && typeof data === 'object' && !Array.isArray(data), '잘못된 frontmatter입니다.');
  return { data, body: markdown.slice(block[0].length) };
}

function checkUrl(value) {
  const url = new URL(value, 'https://archive.invalid/');
  check(['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol), '허용되지 않는 링크 형식입니다.');
}

function checkMarkdown(node) {
  check(node.type !== 'html', '본문에는 HTML 태그 대신 Markdown을 사용해 주세요.');
  if (node.url !== undefined) checkUrl(node.url);
  for (const child of node.children ?? []) checkMarkdown(child);
}

function openingSourceKey(value) {
  if (typeof value !== 'string' || !/^https?:\/\/[^/]/iu.test(value) || /[\s\\]/u.test(value) || !URL.canParse(value)) return null;
  const url = new URL(value);
  if (url.username || url.password) return null;
  // An anchor points into the same posting. Query parameters may identify different postings.
  url.hash = '';
  return url.href;
}

function existingOpeningSources(parse) {
  const sources = new Set(readJson('data/interns.json').map(intern => openingSourceKey(intern.url)).filter(Boolean));
  const directory = 'content/openings';
  if (existsSync(directory)) {
    for (const file of readdirSync(directory, { withFileTypes: true })) {
      if (!file.isFile() || !file.name.endsWith('.md')) continue;
      const { data } = frontmatter(readFileSync(join(directory, file.name), 'utf8'), parse);
      const url = openingSourceKey(data.url);
      if (url) sources.add(url);
    }
  }
  return sources;
}

function checkOpening(data, labs) {
  for (const value of [data.start, data.deadline]) {
    if (value === undefined) continue;
    const time = Date.parse(value);
    const valid = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(value)
      && Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
    check(valid, '공고 접수일은 실제 YYYY-MM-DD 날짜여야 합니다.');
  }
  check(data.verified !== true || data.deadline !== undefined, '접수 마감일을 확인한 공고만 verified: true로 표시할 수 있습니다.');
  check(!data.start || !data.deadline || data.start <= data.deadline, '접수 마감일이 시작일보다 빠릅니다.');
  check(data.lab === undefined || labs.has(data.lab), '공고의 연구실 ID가 data/labs.json에 없습니다.');
}

function checkMatch(data, labs, interns) {
  let records;
  switch (data.kind) {
    case 'lab': records = labs.filter(lab => lab.id === data.target); break;
    case 'intern': records = interns.filter(intern => intern.id === data.target); break;
    case 'company': records = interns.filter(intern => intern.company === data.target); break;
    default: throw new Error('알 수 없는 기회 종류입니다.');
  }
  check(records.length > 0, '추천 대상이 연구실·인턴 데이터에 없습니다.');
  const urls = records.map(record => data.kind === 'lab' ? record.homepage : record.url);
  for (const source of data.sources ?? []) {
    checkUrl(source.url);
    check(typeof source.url === 'string' && urls.includes(source.url), '추천 대상의 원본 자료 링크를 확인할 수 없습니다.');
  }
}

function recommendationKey(directory, data) {
  return directory === 'content/next'
    ? JSON.stringify(['topic', data.topic])
    : JSON.stringify(['match', data.kind, data.target]);
}

// Before writing, use the proposed files. After a rebase, read the merged files from disk.
async function verifyRecommendations(files, pending = new Map()) {
  const paths = files.map(file => file.path).filter(path => ['next', 'match'].includes(contentPath(path)));
  if (paths.length === 0) return;
  const nextCount = paths.filter(path => nextPattern.test(path)).length;
  check(nextCount <= 3 && paths.length - nextCount <= 5, '한 번에 다음 공부 3개, 기회 5개까지 추천할 수 있습니다.');
  const { parse } = await import('yaml');
  function readData(path) {
    checkFile(path);
    check(pending.has(path) || existsSync(path), '추천 파일 또는 근거가 된 공개 항목이 없습니다.');
    return frontmatter(pending.get(path) ?? readFileSync(path, 'utf8'), parse).data;
  }

  const labs = readJson('data/labs.json');
  const interns = readJson('data/interns.json');
  const courses = readJson('data/courses.json');
  const courseNames = new Set([...courses.map(course => course.name), ...labs.flatMap(lab => lab.courses)]);
  const evidenceIds = new Set();
  const proposedKeys = new Set();
  for (const path of paths) {
    const data = readData(path);
    const key = recommendationKey(dirname(path), data);
    check(!proposedKeys.has(key), '중복 추천입니다. 같은 주제나 대상은 한 파일에 기록해 주세요.');
    proposedKeys.add(key);
    check(Array.isArray(data.from) && data.from.length > 0, '추천에 근거가 된 공개 항목이 필요합니다.');
    for (const id of data.from) {
      check(typeof id === 'string' && entryPattern.test('content/entries/' + id + '.md'), '추천 근거는 공개 항목 ID여야 합니다.');
      evidenceIds.add(id);
    }
    if (contentPath(path) === 'match') {
      checkMatch(data, labs, interns);
    } else {
      for (const resource of data.resources ?? []) {
        if (resource.url !== undefined) checkUrl(resource.url);
        if (resource.course !== undefined) check(courseNames.has(resource.course), '추천 과목을 과목표나 연구실 데이터에서 찾을 수 없습니다.');
      }
    }
  }
  for (const directory of new Set(paths.map(dirname))) {
    if (!existsSync(directory)) continue;
    for (const file of readdirSync(directory, { withFileTypes: true })) {
      if (!file.isFile() || !file.name.endsWith('.md')) continue;
      const path = directory + '/' + file.name;
      if (paths.includes(path)) continue;
      const key = recommendationKey(directory, readData(path));
      check(!proposedKeys.has(key), `중복 추천입니다. 기존 파일 ${path}를 갱신해 주세요.`);
    }
  }
  for (const id of evidenceIds) {
    const data = readData('content/entries/' + id + '.md');
    check(data.public === true || data.public === undefined, '추천 근거에는 공개 항목만 사용할 수 있습니다.');
  }
}

async function apply() {
  const result = readJson(process.env.AI_RESULT_FILE);
  check(['ready', 'question', 'unchanged'].includes(result.status) && typeof result.message === 'string', '잘못된 처리 결과입니다.');
  if (result.status !== 'ready') return;
  check(Array.isArray(result.files) && Array.isArray(result.attachments), '변경 파일 또는 첨부 목록이 없습니다.');
  const { route } = readJson(input + '/issue.json');
  check(route !== 'opening' || result.attachments.length === 0, '공고 수집 요청에는 첨부 파일을 추가할 수 없습니다.');
  checkFile(manifestPath);
  const available = new Set(readJson(manifestPath).map(item => item.name).filter(Boolean));
  const { parse } = await import('yaml');
  // Use the same Markdown parser as the Astro 7 build.
  const { markdownToMdast } = await import('satteri');
  const changes = new Map();
  const entries = new Map();
  let openingSources;
  let labIds;

  for (const { path, markdown } of result.files) {
    check(typeof path === 'string' && typeof markdown === 'string' && markdown.trim(), '잘못된 Markdown 변경입니다.');
    const kind = contentPath(path);
    check(kind, '콘텐츠 범위 밖의 파일 경로입니다.');
    check((route === 'opening') === (kind === 'opening'), '공고 수집 요청은 공고 파일만 생성할 수 있고 다른 요청은 공고를 수정할 수 없습니다.');
    const recommendation = kind === 'next' || kind === 'match';
    check(route !== 'recommend' || recommendation, '추천 요청은 추천 파일만 수정할 수 있습니다.');
    check(!recommendation || ['archive', 'memo', 'recommend'].includes(route), '이 요청은 추천 파일을 수정할 수 없습니다.');
    checkFile(path);
    const { data, body } = frontmatter(markdown, parse);
    if (kind === 'opening') {
      const url = openingSourceKey(data.url);
      check(url, '공고 원문은 절대 HTTP(S) URL이어야 합니다.');
      openingSources ??= existingOpeningSources(parse);
      if (openingSources.has(url)) continue;
      check(!existsSync(path), '이미 있는 공고 파일을 덮어쓸 수 없습니다.');
      labIds ??= new Set(readJson('data/labs.json').map(lab => lab.id));
      checkOpening(data, labIds);
      openingSources.add(url);
    }
    check(!changes.has(path), '중복된 변경 경로입니다.');
    checkMarkdown(markdownToMdast(body));
    if (data.url !== undefined) checkUrl(data.url);
    for (const link of data.links ?? []) checkUrl(link.url);
    if (kind === 'entry') {
      const id = path.slice('content/entries/'.length, -'.md'.length);
      const old = existsSync(path) ? frontmatter(readFileSync(path, 'utf8'), parse).data : null;
      check(old || !id.includes('/'), '새 활동은 entries 바로 아래에 작성해야 합니다.');
      check(data.public === undefined || typeof data.public === 'boolean', '잘못된 공개 설정입니다.');
      check(data.attachments === undefined || Array.isArray(data.attachments)
        && data.attachments.every(path => typeof path === 'string'), '잘못된 첨부 목록입니다.');
      check(!old || (old.public ?? true) === (data.public ?? true), '기존 항목의 공개 설정을 바꿀 수 없습니다.');
      entries.set(id, { data, verifiedAttachments: new Set(old?.attachments ?? []) });
    } else if (kind === 'application' && /\/essay-\d+\.md$/.test(path) && data.limit !== undefined) {
      check(Number.isSafeInteger(data.limit) && data.limit > 0, '자소서 글자 수 제한은 양의 정수여야 합니다.');
      const draft = body.replace(/\r\n/g, '\n').replace(/^\n+|\n+$/g, '');
      const count = Array.from(draft).length;
      check(count >= Math.ceil(data.limit * 0.9) && count <= data.limit, '자소서 본문이 글자 수 제한의 90~100% 범위를 벗어났습니다.');
    }
    changes.set(path, markdown);
  }

  await verifyRecommendations(result.files, changes);

  for (const { name, entry } of result.attachments) {
    check(typeof name === 'string' && /^[a-f0-9]{64}\.(?:png|jpg|gif|webp|pdf)$/.test(name) && available.has(name), '준비된 첨부가 아닙니다.');
    const record = entries.get(entry);
    const relative = 'archive/' + entry + '/' + name;
    check(record && record.data.public !== false && record.data.attachments?.includes(relative), '공개 항목이 첨부를 참조해야 합니다.');
    const source = join(input, name);
    const target = 'public/' + relative;
    checkFile(source);
    checkFile(target);
    const bytes = readFileSync(source);
    check(filename(bytes) === name, '첨부 파일 내용이 바뀌었습니다.');
    changes.set(target, bytes);
    record.verifiedAttachments.add(relative);
  }
  for (const { data, verifiedAttachments } of entries.values()) {
    for (const path of data.attachments ?? []) {
      check(verifiedAttachments.has(path), '원본을 확인할 수 없는 첨부 경로입니다.');
    }
  }
  for (const [path, bytes] of changes) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, bytes);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv[2] === 'prepare') await prepare();
  else if (process.argv[2] === 'apply') await apply();
  else if (process.argv[2] === 'verify-recommendations') await verifyRecommendations(readJson(process.env.AI_RESULT_FILE).files);
  else throw new Error('prepare, apply, verify-recommendations 중 하나를 지정하세요.');
}
