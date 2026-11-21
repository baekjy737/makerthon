import type { APIRoute } from 'astro';
import { addComment, getRequest, listComments } from '../../../../../../scripts/agent/firestore.mjs';
import { json, readJson, requireOwner, startProcessing } from '../../../../../lib/server/agent';

export const prerender = false;

const number = (raw: string | undefined) => (/^[1-9]\d{0,8}$/.test(raw ?? '') ? Number(raw) : null);

// GET → 대화 [{ author, bot, body, createdAt }]
export const GET: APIRoute = async ({ request, params }) => {
  const denied = await requireOwner(request);
  if (denied) return denied;
  const n = number(params.n);
  if (!n || !(await getRequest(n))) return json({ error: '요청을 찾을 수 없어요.' }, 404);
  return json(await listComments(n));
};

// POST { body } → 작성자 답변을 남기고 다시 처리한다
export const POST: APIRoute = async ({ request, params }) => {
  const denied = await requireOwner(request);
  if (denied) return denied;
  const n = number(params.n);
  if (!n || !(await getRequest(n))) return json({ error: '요청을 찾을 수 없어요.' }, 404);
  const body = (await readJson(request))?.body;
  if (typeof body !== 'string' || !body.trim() || body.length > 100_000) return json({ error: '답변이 비어 있어요.' }, 400);
  await addComment(n, false, body);
  startProcessing(n);
  return json({ ok: true });
};
