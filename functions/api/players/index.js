// GET  /api/players        (public)
// POST /api/players        (admin)
import { ok, err, readJson } from '../_lib.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  try {
    const url = new URL(request.url);
    const all = url.searchParams.get('all') === '1';
    if (all) {
      const { results } = await env.DB.prepare(
        'SELECT id, name, emoji, tagline, created_at, deleted_at FROM players ORDER BY name ASC'
      ).all();
      const players = (results || []).map((p) => ({ ...p, deleted: !!p.deleted_at }));
      return ok(players);
    }
    const { results } = await env.DB.prepare(
      'SELECT id, name, emoji, tagline, created_at, deleted_at FROM players WHERE deleted_at IS NULL ORDER BY name ASC'
    ).all();
    return ok(results || []);
  } catch (e) {
    return err(e.message, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await readJson(request);
    if (!body || typeof body.name !== 'string' || body.name.trim() === '') {
      return err('name is required and must be a non-empty string', 400);
    }
    const name = body.name.trim();
    const emoji = typeof body.emoji === 'string' && body.emoji.trim() !== '' ? body.emoji.trim() : '🎾';
    const tagline = typeof body.tagline === 'string' ? body.tagline : null;

    const insert = await env.DB.prepare(
      'INSERT INTO players (name, emoji, tagline) VALUES (?, ?, ?)'
    )
      .bind(name, emoji, tagline)
      .run();

    const id = insert.meta.last_row_id;
    const row = await env.DB.prepare(
      'SELECT id, name, emoji, tagline, created_at, deleted_at FROM players WHERE id = ?'
    )
      .bind(id)
      .first();

    return ok(row, { status: 201 });
  } catch (e) {
    return err(e.message, 500);
  }
}
