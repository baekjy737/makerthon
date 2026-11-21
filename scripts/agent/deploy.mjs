// 콘텐츠가 바뀐 뒤 사이트를 다시 빌드하게 한다.
//   VERCEL_DEPLOY_HOOK_URL  Vercel 프로젝트 → Settings → Git → Deploy Hooks에서 만든 주소
// 개발 서버는 .content-stamp가 바뀌면 Firestore 로더가 다시 읽는다(src/lib/firestoreLoader.ts).
import { writeFileSync } from 'node:fs';

export async function afterChange({ stamp = false } = {}) {
  if (stamp) {
    try {
      writeFileSync('.content-stamp', new Date().toISOString());
    } catch {
      /* 읽기 전용 파일 시스템(Vercel)에서는 건너뛴다 */
    }
  }
  const hook = process.env.VERCEL_DEPLOY_HOOK_URL?.trim();
  if (hook) await fetch(hook, { method: 'POST', signal: AbortSignal.timeout(15_000) }).catch(() => {});
}
