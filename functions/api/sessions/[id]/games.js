// POST /api/sessions/:id/games  (admin)
import { ok, err, readJson, parseId } from '../../_lib.js';

function isIntOrNull(v) {
  return v === null || v === undefined || Number.isInteger(v);
}

export async function onRequestPost(context) {
  const { request, env, params } = context;
  try {
    const sessionId = parseId(params.id);
    if (sessionId === null) return err('invalid session id', 400);

    const session = await env.DB.prepare('SELECT id FROM sessions WHERE id = ?').bind(sessionId).first();
    if (!session) return err('session not found', 404);

    const body = await readJson(request);
    if (!body) return err('invalid or missing JSON body', 400);

    const { a1, b1, winner } = body;
    const a2 = body.a2 === undefined ? null : body.a2;
    const b2 = body.b2 === undefined ? null : body.b2;
    const score_text = typeof body.score_text === 'string' ? body.score_text : null;

    if (!Number.isInteger(a1)) return err('a1 is required and must be an integer', 400);
    if (!Number.isInteger(b1)) return err('b1 is required and must be an integer', 400);
    if (!isIntOrNull(a2)) return err('a2 must be an integer or null', 400);
    if (!isIntOrNull(b2)) return err('b2 must be an integer or null', 400);
    if (winner !== 'A' && winner !== 'B') return err("winner is required and must be 'A' or 'B'", 400);

    const slots = [a1, a2, b1, b2].filter((v) => v !== null && v !== undefined);
    const uniqueSlots = new Set(slots);
    if (uniqueSlots.size !== slots.length) {
      return err('a player cannot appear more than once in the same game', 400);
    }

    // Verify all referenced player ids exist.
    const idsToCheck = [...uniqueSlots];
    const placeholders = idsToCheck.map(() => '?').join(', ');
    const { results: foundPlayers } = await env.DB.prepare(
      `SELECT id FROM players WHERE id IN (${placeholders})`
    )
      .bind(...idsToCheck)
      .all();
    const foundIds = new Set((foundPlayers || []).map((p) => p.id));
    const missing = idsToCheck.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      return err(`unknown player id(s): ${missing.join(', ')}`, 400);
    }

    const posRow = await env.DB.prepare(
      'SELECT COALESCE(MAX(position), 0) + 1 AS next_position FROM games WHERE session_id = ?'
    )
      .bind(sessionId)
      .first();
    const position = posRow.next_position;

    const insert = await env.DB.prepare(
      `INSERT INTO games (session_id, position, a1, a2, b1, b2, winner, score_text)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(sessionId, position, a1, a2, b1, b2, winner, score_text)
      .run();

    const id = insert.meta.last_row_id;
    const row = await env.DB.prepare(
      'SELECT id, session_id, position, a1, a2, b1, b2, winner, score_text FROM games WHERE id = ?'
    )
      .bind(id)
      .first();

    return ok(row, { status: 201 });
  } catch (e) {
    return err(e.message, 500);
  }
}
