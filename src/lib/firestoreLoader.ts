// Firestore 콘텐츠 로더. 빌드 때 로그인 없이(웹 SDK) 읽으므로 보안 규칙상 공개 문서만 들어온다.
// 문서 모양은 scripts/agent/store.mjs와 같다: { id, data(frontmatter), body(Markdown), public }.
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Loader } from 'astro/loaders';
import { initializeApp, getApps } from 'firebase/app';
import { collection, getDocs, getFirestore, query, where } from 'firebase/firestore';

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain?: string;
  projectId: string;
  appId?: string;
}

/** PUBLIC_FIREBASE_* 환경 변수에서 웹 설정을 읽는다. 프로젝트 ID나 API 키가 없으면 null(파일 모드) */
export function firebaseWebConfig(env: Record<string, string | undefined>): FirebaseWebConfig | null {
  const apiKey = env.PUBLIC_FIREBASE_API_KEY?.trim();
  const projectId = env.PUBLIC_FIREBASE_PROJECT_ID?.trim();
  if (!apiKey || !projectId) return null;
  return {
    apiKey,
    projectId,
    authDomain: env.PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() || `${projectId}.firebaseapp.com`,
    appId: env.PUBLIC_FIREBASE_APP_ID?.trim() || undefined,
  };
}

/** 개발 서버에서 이 파일이 바뀌면 다시 읽는다(로컬 AI 실행기가 반영 뒤 건드린다) */
export const CONTENT_STAMP = '.content-stamp';

export function firestoreLoader(name: string, config: FirebaseWebConfig): Loader {
  return {
    name: `firestore-${name}`,
    async load({ store, parseData, generateDigest, renderMarkdown, logger, watcher }) {
      const app = getApps().find((a) => a.name === 'content') ?? initializeApp(config, 'content');
      const db = getFirestore(app);

      async function sync() {
        const ref = collection(db, name);
        // 보안 규칙이 public == true 조건이 있는 질의만 허용한다(entries)
        const snap = await getDocs(name === 'entries' ? query(ref, where('public', '==', true)) : ref);
        store.clear();
        for (const doc of snap.docs) {
          const row = doc.data() as { id?: string; data?: Record<string, unknown>; body?: string };
          const id = row.id ?? decodeURIComponent(doc.id);
          const body = row.body ?? '';
          const data = await parseData({ id, data: row.data ?? {} });
          store.set({
            id,
            data,
            body,
            rendered: await renderMarkdown(body),
            digest: generateDigest({ data: row.data ?? {}, body }),
          });
        }
        logger.info(`Firestore ${name}: ${snap.size}개`);
      }

      await sync();

      if (watcher) {
        const stamp = resolve(CONTENT_STAMP);
        if (!existsSync(stamp)) writeFileSync(stamp, '');
        watcher.add(stamp);
        watcher.on('change', async (path) => {
          if (resolve(path) !== stamp) return;
          try {
            await sync();
          } catch (e) {
            logger.error(`Firestore ${name} 다시 읽기 실패: ${String(e)}`);
          }
        });
      }
    },
  };
}
