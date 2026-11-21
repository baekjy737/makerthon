import type { APIRoute } from 'astro';
import { createRequest } from '../../../../../scripts/agent/firestore.mjs';
import { LABELS } from '../../../../../scripts/agent/pipeline.mjs';
import { json, readJson, requireOwner, startProcessing } from '../../../../lib/server/agent';

export const prerender = false;

// POST { label, title, body } → { number, createdAt }
export const POST: APIRoute = async ({ request }) => {
  const denied = await requireOwner(request);
  if (denied) return denied;
  const input = await readJson(request);
  const { label, title, body } = input ?? {};
  if (typeof label !== 'string' || !LABELS.includes(label) || typeof title !== 'string' || !title.trim() || typeof body !== 'string' || body.length > 100_000) {
    return json({ error: '요청 내용이 올바르지 않아요.' }, 400);
  }
  const r = await createRequest({ route: label, title: title.trim(), body });
  startProcessing(r.number);
  return json({ number: r.number, createdAt: r.createdAt });
};
