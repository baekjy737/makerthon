// 이 저장소의 content/**.md를 Firestore에, public/archive/**를 Vercel Blob에 올린다(처음 셋업·샘플 데이터용).
//   npm run seed            .env의 FIREBASE_SERVICE_ACCOUNT, BLOB_READ_WRITE_TOKEN을 쓴다
//   npm run seed -- --dry   올릴 목록만 보여 준다
// 같은 ID의 문서는 덮어쓴다. Firestore에만 있는 문서는 지우지 않는다.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { checkSchema } from './agent/pipeline.mjs';
import { pathToDoc } from './agent/content.mjs';

const dry = process.argv.includes('--dry');

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = join(dir, d.name);
    return d.isDirectory() ? walk(p) : d.isFile() ? [p] : [];
  });
}
const posix = (p) => relative('.', p).split(sep).join('/');

const files = walk('content')
  .map(posix)
  .filter((p) => pathToDoc(p))
  .map((path) => ({ path, markdown: readFileSync(path, 'utf8') }));
for (const f of files) checkSchema(f.path, f.markdown);
const attachments = walk('public/archive').map(posix).filter((p) => !p.split('/').pop().startsWith('.'));

console.log(`콘텐츠 ${files.length}개, 첨부 ${attachments.length}개`);
if (dry) {
  for (const f of files) console.log('  ', f.path);
  for (const a of attachments) console.log('  ', a);
  process.exit(0);
}

const { saveContent } = await import('./agent/firestore.mjs');
for (let i = 0; i < files.length; i += 400) await saveContent(files.slice(i, i + 400));
console.log('Firestore 완료');

if (attachments.length) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.log('BLOB_READ_WRITE_TOKEN이 없어 첨부는 건너뛰었어요.');
  } else {
    const { saveFile } = await import('./agent/blob.mjs');
    for (const a of attachments) await saveFile(a.slice('public/'.length), readFileSync(a));
    console.log('Blob 완료');
  }
}
