// PUT    /api/players/:id  (admin)
// DELETE /api/players/:id  (admin)
import { ok, err, readJson, parseId } from '../_lib.js';

export async function onRequestPut(context) {
  const { request, env, params } = context;
  try {
    const id = parseId(params.id);
    if (id === null) return err('invalid id', 400);

    const body = await readJson(request);
    if (!body) return err('invalid or missing JSON body', 400);

    const existing = await env.DB.prepare(
      'SELECT id, name, emoji, tagline, created_at, deleted_at FROM players WHERE id = ?'
    )
      .bind(id)
      .first();
    if (!existing) return err('player not found', 404);

    const fields = [];
    const values = [];

    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim() === '') {
        return err('name must be a non-empty string', 400);
      }
      fields.push('name = ?');
      values.push(body.name.trim());
    }
    if (body.emoji !== undefined) {
      if (typeof body.emoji !== 'string' || body.emoji.trim() === '') {
        return err('emoji must be a non-empty string', 400);
      }
      fields.push('emoji = ?');
      values.push(body.emoji.trim());
    }
    if (body.tagline !== undefined) {
      if (body.tagline !== null && typeof body.tagline !== 'string') {
        return err('tagline must be a string or null', 400);
      }
      fields.push('tagline = ?');
      values.push(body.tagline);
    }
    if (body.restore === true) {
      fields.push('deleted_at = NULL');
    }

    if (fields.length === 0) {
      return ok(existing);
    }

    values.push(id);
    await env.DB.prepare(`UPDATE players SET ${fields.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    const updated = await env.DB.prepare(
      'SELECT id, name, emoji, tagline, created_at, deleted_at FROM players WHERE id = ?'
    )
      .bind(id)
      .first();

    return ok(updated);
  } catch (e) {
    return err(e.message, 500);
  }
}

export async function onRequestDelete(context) {
  const { env, params } = context;
  try {
    const id = parseId(params.id);
    if (id === null) return err('invalid id', 400);

    const existing = await env.DB.prepare('SELECT id FROM players WHERE id = ?').bind(id).first();
    if (!existing) return err('player not found', 404);

    await env.DB.prepare("UPDATE players SET deleted_at = datetime('now') WHERE id = ?")
      .bind(id)
      .run();

    return ok({ id });
  } catch (e) {
    return err(e.message, 500);
  }
}
