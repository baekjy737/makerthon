// 저장소 경로(content/**.md) ↔ Firestore 문서 변환. 파일 모드·Firestore 모드·AI 파이프라인이 같이 쓴다.
// 문서 모양: { id, data(frontmatter 객체), body(Markdown), public(boolean) }
import { parse, stringify } from 'yaml';

/** 컬렉션 이름과 저장소 경로 규칙. id는 Astro 컬렉션 id와 같다 */
export const COLLECTIONS = ['entries', 'applications', 'essays', 'next', 'matches', 'openings'];

/**
 * 저장소 상대 경로를 { collection, id }로 바꾼다. 콘텐츠 경로가 아니면 null.
 * @param {string} path
 */
export function pathToDoc(path) {
  let m;
  if ((m = /^content\/entries\/(.+)\.md$/.exec(path))) return { collection: 'entries', id: m[1] };
  if ((m = /^content\/applications\/([^/]+)\/index\.md$/.exec(path))) return { collection: 'applications', id: m[1] };
  if ((m = /^content\/applications\/([^/]+\/essay-\d+)\.md$/.exec(path))) return { collection: 'essays', id: m[1] };
  if ((m = /^content\/(next|matches|openings)\/([^/]+)\.md$/.exec(path))) return { collection: m[1], id: m[2] };
  return null;
}

/** @param {string} collection @param {string} id */
export function docToPath(collection, id) {
  switch (collection) {
    case 'entries': return `content/entries/${id}.md`;
    case 'applications': return `content/applications/${id}/index.md`;
    case 'essays': return `content/applications/${id}.md`;
    case 'next': case 'matches': case 'openings': return `content/${collection}/${id}.md`;
    default: throw new Error(`알 수 없는 컬렉션: ${collection}`);
  }
}

/** Firestore 문서 ID. `/`가 들어간 id(하위 폴더 항목, 자소서) 때문에 인코딩한다 */
export const docKey = (id) => encodeURIComponent(id);

/** frontmatter가 있는 Markdown을 { data, body }로 */
export function parseMarkdown(markdown) {
  const block = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(markdown);
  if (!block) return { data: {}, body: markdown };
  const data = parse(block[1]) ?? {};
  return { data, body: markdown.slice(block[0].length) };
}

/** { data, body } → frontmatter Markdown */
export function toMarkdown(data, body) {
  return `---\n${stringify(data).trimEnd()}\n---\n${body ?? ''}`;
}

/** Firestore에는 JSON 값만 넣는다(yaml이 Date로 읽은 값은 YYYY-MM-DD 문자열로) */
function plain(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).map(([k, v]) => [k, plain(v)]));
  }
  return value;
}

/**
 * Markdown 파일 하나를 Firestore 문서로. entries만 public 값을 그대로(기본 true) 쓰고,
 * 다른 컬렉션은 사이트에 공개되는 콘텐츠라 public: true다.
 */
export function markdownToDoc(collection, id, markdown) {
  const { data, body } = parseMarkdown(markdown);
  const clean = plain(data);
  return { id, data: clean, body, public: collection === 'entries' ? clean.public !== false : true };
}

/** Firestore 문서 → Markdown 파일 내용 */
export function docToMarkdown(doc) {
  return toMarkdown(doc.data ?? {}, doc.body ?? '');
}
