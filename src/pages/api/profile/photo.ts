// 메인 프로필 사진 바꾸기: 주인만. Vercel Blob에 올리고 Firestore site/profile.photo에 주소를 둔다.
// 방문자 화면은 Hero가 Firestore(공개 읽기)에서 이 주소를 읽어 바로 보여 준다(다시 빌드 필요 없음).
import type { APIRoute } from 'astro';
import { put } from '@vercel/blob';
import { db, firebaseConfigured, ownerFromHeader } from '../../../../scripts/agent/firestore.mjs';
import { json } from '../../../lib/server/agent';

export const prerender = false;

const MAX_BYTES = 4 * 1024 * 1024; // Vercel 함수 요청 본문 한도(4.5MB) 안
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

export const POST: APIRoute = async ({ request }) => {
  if (!firebaseConfigured() || !process.env.OWNER_EMAIL?.trim() || !process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    return json({ error: '사진 저장 설정(Firebase·OWNER_EMAIL·Blob)이 아직 없어요.' }, 503);
  }
  if (!(await ownerFromHeader(request.headers.get('authorization')))) {
    return json({ error: '사이트 주인 계정으로 로그인해 주세요.' }, 401);
  }
  const type = request.headers.get('content-type')?.split(';')[0].trim() ?? '';
  const ext = EXT[type];
  if (!ext) return json({ error: 'JPG·PNG·WebP·GIF 이미지만 올릴 수 있어요.' }, 415);
  const bytes = Buffer.from(await request.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_BYTES) return json({ error: '4MB 이하 이미지만 올릴 수 있어요.' }, 413);

  // 매번 새 경로라 CDN 캐시에 옛 사진이 남지 않는다. shortcut: 예전 사진은 Blob에 남는다, 용량이 문제 되면 지운다
  const { url } = await put(`site/profile-${Date.now()}.${ext}`, bytes, { access: 'public', contentType: type });
  await db().doc('site/profile').set({ photo: url, updatedAt: new Date().toISOString() }, { merge: true });
  return json({ photo: url });
};
