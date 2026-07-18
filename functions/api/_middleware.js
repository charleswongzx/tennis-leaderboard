// Admin-key gate for all mutating requests under /api/*, plus no-store caching.
export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method;
  if (method !== 'GET' && method !== 'OPTIONS' && method !== 'HEAD') {
    const key = request.headers.get('X-Admin-Key');
    if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) {
      return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }
  }
  const response = await context.next();
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
