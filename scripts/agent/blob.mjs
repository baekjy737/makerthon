// 첨부 파일 저장소(Vercel Blob, 공개 스토어). BLOB_READ_WRITE_TOKEN이 필요하다(Vercel 프로젝트 → Storage → Blob 연결 시 자동).
//   archive/<항목>/<sha256>.<ext>   공개 항목의 첨부(사이트에 보임). 비공개 항목 첨부는 검증기가 여기로 보내지 않는다
//   uploads/<nonce>/<파일명>         대화창 업로드 원본. nonce는 무작위 16자라 주소를 추측할 수 없고, 처리 뒤 지운다
import { del, head, list, put } from '@vercel/blob';

/** @param {string} path archive/<항목>/<파일> @param {Buffer} bytes */
export async function saveFile(path, bytes) {
  await put(path, bytes, { access: 'public', addRandomSuffix: false, allowOverwrite: true });
}

/** @param {string} nonce @param {string} file */
export async function readUpload(nonce, file) {
  const info = await head(`uploads/${nonce}/${file}`).catch(() => null);
  if (!info) return null;
  const res = await fetch(info.url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

/** @param {string[]} nonces */
export async function cleanupUploads(nonces) {
  for (const nonce of nonces) {
    const { blobs } = await list({ prefix: `uploads/${nonce}/` });
    if (blobs.length) await del(blobs.map((b) => b.url));
  }
}

