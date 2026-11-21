import type { APIRoute } from 'astro';
import { json, serverReady } from '../../../lib/server/agent';

export const prerender = false;

// 대화창이 서버 AI를 쓸 수 있는지 확인한다(비밀값은 내보내지 않는다)
export const GET: APIRoute = () => json({ ready: serverReady() });
