// Every write under /api/* needs the umpire cookie (except logging in/out).
// Reads stay public: anyone with the URL can follow along. Responses are never cached.
import { isUmpire } from './_auth.js';

const OPEN_WRITES = new Set(['/api/login', '/api/logout']);

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method;
  const path = new URL(request.url).pathname;

  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    // JSON-only writes: a cross-site form cannot send this content type without CORS.
    const type = request.headers.get('Content-Type') || '';
    if (!type.includes('application/json')) {
      return Response.json({ ok: false, error: 'writes must be JSON' }, { status: 415 });
    }
    if (!OPEN_WRITES.has(path) && !(await isUmpire(request, env))) {
      return Response.json({ ok: false, error: 'umpires only: log in to make changes' }, { status: 401 });
    }
  }

  const response = await context.next();
  const out = new Response(response.body, response);
  out.headers.set('Cache-Control', 'no-store');
  return out;
}
