import type { APIRoute } from 'astro';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { json, requireOwner } from '../../../lib/server/agent';

export const prerender = false;

const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf'];
// 대화창(src/lib/agent.ts)이 만드는 경로: uploads/<nonce 16자>/<safeFilename>
const PATH = /^uploads\/[a-z0-9]{16}\/[A-Za-z0-9_-][A-Za-z0-9._-]{0,99}$/;

// 브라우저가 Vercel Blob에 직접 올릴 수 있도록 짧은 업로드 토큰을 준다(함수 본문 4.5MB 제한을 피한다)
export const POST: APIRoute = async ({ request }) => {
  const denied = await requireOwner(request);
  if (denied) return denied;
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return json({ error: '요청을 읽지 못했어요.' }, 400);
  }
  if (body.type !== 'blob.generate-client-token') return json({ error: '지원하지 않는 요청이에요.' }, 400);
  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        if (!PATH.test(pathname) || pathname.includes('..')) throw new Error('잘못된 파일 이름이에요.');
        return { allowedContentTypes: TYPES, maximumSizeInBytes: MAX_BYTES, addRandomSuffix: false, allowOverwrite: false };
      },
    });
    return json(result);
  } catch (e) {
    return json({ error: (e as Error).message || '업로드를 준비하지 못했어요.' }, 400);
  }
};
