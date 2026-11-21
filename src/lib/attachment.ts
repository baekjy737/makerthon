// 첨부 주소(빌드 때). public/에 파일이 있으면 사이트 경로, 없으면 Vercel Blob 공개 주소(AI가 올린 첨부).
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { withBase } from './url';

/** BLOB_READ_WRITE_TOKEN(vercel_blob_rw_<storeId>_…)이나 PUBLIC_BLOB_BASE_URL에서 공개 스토어 주소를 만든다 */
export function blobBaseUrl(env: Record<string, string | undefined> = process.env): string | null {
  const explicit = env.PUBLIC_BLOB_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  const id = /^vercel_blob_rw_([A-Za-z0-9]+)_/.exec(env.BLOB_READ_WRITE_TOKEN ?? '')?.[1];
  return id ? `https://${id.toLowerCase()}.public.blob.vercel-storage.com` : null;
}

/** attachments의 `archive/<항목>/<파일>` → 브라우저 주소 */
export function attachmentUrl(path: string, env: Record<string, string | undefined> = process.env): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return path;
  const blob = blobBaseUrl(env);
  if (!blob || existsSync(resolve(process.cwd(), 'public', path))) return withBase(path);
  return `${blob}/${path.replace(/^\/+/, '')}`;
}
