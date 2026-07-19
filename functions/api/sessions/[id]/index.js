// GET    /api/sessions/:id  (public)
// PUT    /api/sessions/:id  (admin)
// DELETE /api/sessions/:id  (admin)
import { ok, err, readJson, parseId, isValidDate } from '../../_lib.js';

export async function onRequestGet(context) {
  const { env, params } = context;
  try {
    const id = parseId(params.id);
    if (id === null) return err('invalid id', 400);

    const session = await env.DB.prepare(
      'SELECT id, date, title, notes, created_at FROM sessions WHERE id = ?'
    )
      .bind(id)
      .first();
    if (!session) return err('session not found', 404);

    const [gamesRes, pointsRes, activePlayersRes] = await env.DB.batch([
      env.DB.prepare(
        'SELECT id, a1, a2, b1, b2, winner, score_text, position FROM games WHERE session_id = ? ORDER BY position ASC'
      ).bind(id),
      env.DB.prepare('SELECT player_id, points FROM session_points WHERE session_id = ?').bind(id),
      env.DB.prepare(
        'SELECT id, name, emoji, deleted_at FROM players WHERE deleted_at IS NULL'
      ),
    ]);

    const games = gamesRes.results || [];
    const points = pointsRes.results || [];
    const activePlayers = activePlayersRes.results || [];

    // Collect all player ids referenced by games/points so we can include
    // soft-deleted players too (client needs names without a second fetch).
    const referencedIds = new Set();
    for (const g of games) {
      for (const pid of [g.a1, g.a2, g.b1, g.b2]) {
        if (pid !== null && pid !== undefined) referencedIds.add(pid);
      }
    }
    for (const p of points) referencedIds.add(p.player_id);

    const activeIds = new Set(activePlayers.map((p) => p.id));
    const missingIds = [...referencedIds].filter((pid) => !activeIds.has(pid));

    let extraPlayers = [];
    if (missingIds.length > 0) {
      const placeholders = missingIds.map(() => '?').join(', ');
      const { results } = await env.DB.prepare(
        `SELECT id, name, emoji, deleted_at FROM players WHERE id IN (${placeholders})`
      )
        .bind(...missingIds)
        .all();
      extraPlayers = results || [];
    }

    const players = [
      ...activePlayers.map((p) => ({ id: p.id, name: p.name, emoji: p.emoji, deleted: !!p.deleted_at })),
      ...extraPlayers.map((p) => ({ id: p.id, name: p.name, emoji: p.emoji, deleted: !!p.deleted_at })),
    ];

    return ok({ session, games, points, players });
  } catch (e) {
    return err(e.message, 500);
  }
}

export async function onRequestPut(context) {
  const { request, env, params } = context;
  try {
    const id = parseId(params.id);
    if (id === null) return err('invalid id', 400);

    const existing = await env.DB.prepare(
      'SELECT id, date, title, notes, created_at FROM sessions WHERE id = ?'
    )
      .bind(id)
      .first();
    if (!existing) return err('session not found', 404);

    const body = await readJson(request);
    if (!body) return err('invalid or missing JSON body', 400);

    const fields = [];
    const values = [];

    if (body.date !== undefined) {
      if (!isValidDate(body.date)) return err('date must be in YYYY-MM-DD format', 400);
      fields.push('date = ?');
      values.push(body.date);
    }
    if (body.title !== undefined) {
      if (body.title !== null && typeof body.title !== 'string') {
        return err('title must be a string or null', 400);
      }
      fields.push('title = ?');
      values.push(body.title);
    }
    if (body.notes !== undefined) {
      if (body.notes !== null && typeof body.notes !== 'string') {
        return err('notes must be a string or null', 400);
      }
      fields.push('notes = ?');
      values.push(body.notes);
    }

    if (fields.length === 0) return ok(existing);

    values.push(id);
    await env.DB.prepare(`UPDATE sessions SET ${fields.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    const updated = await env.DB.prepare(
      'SELECT id, date, title, notes, created_at FROM sessions WHERE id = ?'
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

    const existing = await env.DB.prepare('SELECT id FROM sessions WHERE id = ?').bind(id).first();
    if (!existing) return err('session not found', 404);

    await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(id).run();

    return ok({ id });
  } catch (e) {
    return err(e.message, 500);
  }
}
