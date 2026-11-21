// /api/agent/* 공용: 주인 확인, JSON 응답, 요청 처리 시작.
import { waitUntil } from '@vercel/functions';
import { cleanupUploads, readUpload, saveFile } from '../../../scripts/agent/blob.mjs';
import { afterChange } from '../../../scripts/agent/deploy.mjs';
import { firebaseConfigured, firestoreStore, ownerFromHeader } from '../../../scripts/agent/firestore.mjs';
import { processRequest } from '../../../scripts/agent/pipeline.mjs';
import { runWithApi } from '../../../scripts/agent/run-api.mjs';

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

/** 서버 AI 실행에 필요한 설정이 다 있는지 */
export function serverReady(): boolean {
  return firebaseConfigured() && !!process.env.OWNER_EMAIL?.trim() && !!process.env.ANTHROPIC_API_KEY?.trim();
}

/** 주인이 아니면 401 응답, 맞으면 null */
export async function requireOwner(request: Request): Promise<Response | null> {
  if (!serverReady()) return json({ error: '서버 AI 설정(Firebase·OWNER_EMAIL·ANTHROPIC_API_KEY)이 아직 없어요.' }, 503);
  const owner = await ownerFromHeader(request.headers.get('authorization'));
  return owner ? null : json({ error: '사이트 주인 계정으로 로그인해 주세요.' }, 401);
}

/** 응답을 보낸 뒤에도 함수가 끝날 때까지(최대 maxDuration) 요청을 처리한다 */
export function startProcessing(number: number): void {
  waitUntil(
    processRequest(number, {
      store: firestoreStore,
      runAI: (dir: string) => runWithApi(dir, { log: console.log }),
      readUpload,
      saveFile,
      cleanupUploads,
      afterChange: () => afterChange(),
      log: console.log,
    }),
  );
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? body : null;
  } catch {
    return null;
  }
}
