// Rolax Weembledon '94 - Cloudflare Worker entry.
// Static pages in /public are served as Worker assets; requests under /api/* run here.
import { isUmpire } from './api/_auth.js';
import { ensureSchema } from './api/_schema.js';
import * as login from './api/login.js';
import * as logout from './api/logout.js';
import * as me from './api/me.js';
import * as events from './api/events/index.js';
import * as eventById from './api/events/[id].js';

const ROUTES = [
  { path: /^\/api\/login$/, mod: login, open: true },
  { path: /^\/api\/logout$/, mod: logout, open: true },
  { path: /^\/api\/me$/, mod: me },
  { path: /^\/api\/events$/, mod: events },
  { path: /^\/api\/events\/([^/]+)$/, mod: eventById, params: ['id'] },
];

const HANDLER = { GET: 'onRequestGet', HEAD: 'onRequestGet', POST: 'onRequestPost', PUT: 'onRequestPut', DELETE: 'onRequestDelete' };

function json(body, status) {
  return Response.json(body, { status });
}

async function handleApi(request, env, url) {
  if (!env.DB) {
    // preview builds run without a database (see [previews] in wrangler.toml)
    return json({ ok: false, error: 'this is a preview build with no database. Scores live on the production site' }, 503);
  }
  const route = ROUTES.map((r) => ({ r, m: url.pathname.match(r.path) })).find((x) => x.m);
  if (!route) return json({ ok: false, error: 'no such endpoint' }, 404);
  const handler = route.r.mod[HANDLER[request.method]];
  if (!handler) return json({ ok: false, error: 'method not allowed' }, 405);

  const write = request.method !== 'GET' && request.method !== 'HEAD';
  if (write) {
    // JSON-only writes: a cross-site form cannot send this content type without CORS.
    const type = request.headers.get('Content-Type') || '';
    if (!type.includes('application/json')) return json({ ok: false, error: 'writes must be JSON' }, 415);
    // Reads stay public; every write needs the umpire cookie (except logging in/out).
    if (!route.r.open && !(await isUmpire(request, env))) {
      return json({ ok: false, error: 'umpires only: log in to make changes' }, 401);
    }
  }

  const params = {};
  (route.r.params || []).forEach((name, i) => { params[name] = decodeURIComponent(route.m[i + 1]); });

  await ensureSchema(env);
  const response = await handler({ request, env, params });
  const out = new Response(response.body, response);
  out.headers.set('Cache-Control', 'no-store');
  return out;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, env, url);
      } catch (e) {
        return json({ ok: false, error: e.message || 'server error' }, 500);
      }
    }
    return env.ASSETS.fetch(request);
  },
};
