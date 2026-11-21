// 서버 쪽 Firestore(firebase-admin). 쓰기는 모두 여기서만 한다. 보안 규칙은 브라우저 쓰기를 막는다.
//   FIREBASE_SERVICE_ACCOUNT  서비스 계정 JSON 한 줄(Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 새 비공개 키)
//   또는 GOOGLE_APPLICATION_CREDENTIALS(키 파일 경로)
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { COLLECTIONS, docKey, docToMarkdown, docToPath, markdownToDoc, pathToDoc } from './content.mjs';

function app() {
  const existing = getApps().find((a) => a.name === 'admin');
  if (existing) return existing;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  const credential = raw ? cert(JSON.parse(raw)) : applicationDefault();
  return initializeApp({ credential }, 'admin');
}

export const db = () => getFirestore(app());

/** 서버에 Firebase가 설정돼 있는지 */
export const firebaseConfigured = () => !!(process.env.FIREBASE_SERVICE_ACCOUNT?.trim() || process.env.GOOGLE_APPLICATION_CREDENTIALS);

/**
 * Authorization: Bearer <Firebase ID 토큰>이 주인(OWNER_EMAIL)인지 확인한다. 아니면 null.
 * @param {string | null | undefined} header
 */
export async function ownerFromHeader(header) {
  const token = /^Bearer (.+)$/.exec(header ?? '')?.[1];
  if (!token) return null;
  return ownerFromToken(token);
}

// Firebase ID 토큰을 Google 공개 키로 직접 검증한다. firebase-admin/auth는 Vercel 런타임에서
// ESM 전용 의존성(jose 6)을 require()하다 실패해서 쓰지 않는다.
const firebaseKeys = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);

function projectId() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (raw) {
    try {
      return JSON.parse(raw).project_id;
    } catch {
      /* 아래 값 사용 */
    }
  }
  return process.env.PUBLIC_FIREBASE_PROJECT_ID?.trim();
}

/** @param {string} token */
export async function ownerFromToken(token) {
  const owner = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const project = projectId();
  if (!owner || !project) return null;
  try {
    const { payload } = await jwtVerify(token, firebaseKeys, {
      issuer: `https://securetoken.google.com/${project}`,
      audience: project,
      algorithms: ['RS256'],
    });
    if (typeof payload.sub !== 'string' || !payload.sub) return null;
    const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
    return payload.email_verified === true && email === owner ? payload : null;
  } catch {
    return null;
  }
}

// --- 콘텐츠 ---

/** 모든 콘텐츠(비공개 포함)를 작업 폴더에 content/**.md로 쓴다 */
export async function exportContent(dir) {
  const store = db();
  for (const collection of COLLECTIONS) {
    const snap = await store.collection(collection).get();
    for (const doc of snap.docs) {
      const row = doc.data();
      const path = join(dir, docToPath(collection, row.id ?? decodeURIComponent(doc.id)));
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, docToMarkdown(row));
    }
  }
}

/**
 * 검증을 통과한 Markdown 파일들을 Firestore에 쓴다. files: [{ path, markdown }]
 * @param {{ path: string, markdown: string }[]} files
 */
export async function saveContent(files) {
  const batch = db().batch();
  for (const { path, markdown } of files) {
    const target = pathToDoc(path);
    if (!target) throw new Error(`콘텐츠 경로가 아닙니다: ${path}`);
    const doc = markdownToDoc(target.collection, target.id, markdown);
    batch.set(db().collection(target.collection).doc(docKey(target.id)), { ...doc, updatedAt: new Date().toISOString() });
  }
  await batch.commit();
}

// --- 요청 대화 (GitHub 이슈 대신) ---

/** @typedef {{ author: string, bot: boolean, body: string, createdAt: string }} Comment */
/** @typedef {{ number: number, route: string, title: string, body: string, createdAt: string }} Request */

/** 새 요청 번호를 받아 요청을 만든다 */
export async function createRequest({ route, title, body }) {
  const store = db();
  const counter = store.collection('meta').doc('requests');
  const createdAt = new Date().toISOString();
  const number = await store.runTransaction(async (tx) => {
    const snap = await tx.get(counter);
    const n = (snap.exists ? snap.data().next : 1) ?? 1;
    tx.set(counter, { next: n + 1 });
    tx.set(store.collection('requests').doc(String(n)), { number: n, route, title, body, createdAt });
    return n;
  });
  return { number, route, title, body, createdAt };
}

/** @returns {Promise<Request | null>} */
export async function getRequest(number) {
  const snap = await db().collection('requests').doc(String(number)).get();
  return snap.exists ? /** @type {Request} */ (snap.data()) : null;
}

export async function setRoute(number, route) {
  await db().collection('requests').doc(String(number)).update({ route });
}

/** @returns {Promise<Comment[]>} */
export async function listComments(number) {
  const snap = await db().collection('requests').doc(String(number)).collection('comments').orderBy('createdAt').get();
  return snap.docs.map((d) => /** @type {Comment} */ (d.data()));
}

export async function addComment(number, bot, body) {
  await db().collection('requests').doc(String(number)).collection('comments').add({
    author: bot ? 'claude' : 'me',
    bot,
    body,
    createdAt: new Date().toISOString(),
  });
}

/** 파이프라인이 쓰는 저장소 묶음(로컬 실행기도 같은 모양을 쓴다) */
export const firestoreStore = { exportContent, saveContent, getRequest, setRoute, listComments, addComment };
