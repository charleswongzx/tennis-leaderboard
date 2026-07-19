// PUT /api/sessions/:id/points  (admin) — replace-all
import { ok, err, readJson, parseId } from '../../_lib.js';

export async function onRequestPut(context) {
  const { request, env, params } = context;
  try {
    const sessionId = parseId(params.id);
    if (sessionId === null) return err('invalid session id', 400);

    const session = await env.DB.prepare('SELECT id FROM sessions WHERE id = ?').bind(sessionId).first();
    if (!session) return err('session not found', 404);

    const body = await readJson(request);
    if (!body || !Array.isArray(body.points)) {
      return err('points is required and must be an array', 400);
    }

    const seen = new Set();
    for (const entry of body.points) {
      if (!entry || typeof entry !== 'object') {
        return err('each points entry must be an object', 400);
      }
      if (!Number.isInteger(entry.player_id)) {
        return err('each points entry requires an integer player_id', 400);
      }
      if (!Number.isInteger(entry.points)) {
        return err('each points entry requires an integer points value', 400);
      }
      if (seen.has(entry.player_id)) {
        return err(`duplicate player_id in points: ${entry.player_id}`, 400);
      }
      seen.add(entry.player_id);
    }

    if (body.points.length > 0) {
      const ids = [...seen];
      const placeholders = ids.map(() => '?').join(', ');
      const { results: foundPlayers } = await env.DB.prepare(
        `SELECT id FROM players WHERE id IN (${placeholders})`
      )
        .bind(...ids)
        .all();
      const foundIds = new Set((foundPlayers || []).map((p) => p.id));
      const missing = ids.filter((id) => !foundIds.has(id));
      if (missing.length > 0) {
        return err(`unknown player id(s): ${missing.join(', ')}`, 400);
      }
    }

    const statements = [
      env.DB.prepare('DELETE FROM session_points WHERE session_id = ?').bind(sessionId),
      ...body.points.map((p) =>
        env.DB.prepare(
          'INSERT INTO session_points (session_id, player_id, points) VALUES (?, ?, ?)'
        ).bind(sessionId, p.player_id, p.points)
      ),
    ];

    await env.DB.batch(statements);

    const { results } = await env.DB.prepare(
      'SELECT player_id, points FROM session_points WHERE session_id = ?'
    )
      .bind(sessionId)
      .all();

    return ok(results || []);
  } catch (e) {
    return err(e.message, 500);
  }
}
