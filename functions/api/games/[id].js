// PUT    /api/games/:id  (admin)
// DELETE /api/games/:id  (admin)
import { ok, err, readJson, parseId } from '../_lib.js';

function isIntOrNull(v) {
  return v === null || v === undefined || Number.isInteger(v);
}

export async function onRequestPut(context) {
  const { request, env, params } = context;
  try {
    const id = parseId(params.id);
    if (id === null) return err('invalid id', 400);

    const existing = await env.DB.prepare(
      'SELECT id, session_id, position, a1, a2, b1, b2, winner, score_text FROM games WHERE id = ?'
    )
      .bind(id)
      .first();
    if (!existing) return err('game not found', 404);

    const body = await readJson(request);
    if (!body) return err('invalid or missing JSON body', 400);

    const merged = {
      a1: body.a1 !== undefined ? body.a1 : existing.a1,
      a2: body.a2 !== undefined ? body.a2 : existing.a2,
      b1: body.b1 !== undefined ? body.b1 : existing.b1,
      b2: body.b2 !== undefined ? body.b2 : existing.b2,
      winner: body.winner !== undefined ? body.winner : existing.winner,
      score_text: body.score_text !== undefined ? body.score_text : existing.score_text,
      position: body.position !== undefined ? body.position : existing.position,
    };

    if (!Number.isInteger(merged.a1)) return err('a1 must be an integer', 400);
    if (!Number.isInteger(merged.b1)) return err('b1 must be an integer', 400);
    if (!isIntOrNull(merged.a2)) return err('a2 must be an integer or null', 400);
    if (!isIntOrNull(merged.b2)) return err('b2 must be an integer or null', 400);
    if (merged.winner !== 'A' && merged.winner !== 'B') return err("winner must be 'A' or 'B'", 400);
    if (merged.score_text !== null && typeof merged.score_text !== 'string') {
      return err('score_text must be a string or null', 400);
    }
    if (!Number.isInteger(merged.position)) return err('position must be an integer', 400);

    const slots = [merged.a1, merged.a2, merged.b1, merged.b2].filter(
      (v) => v !== null && v !== undefined
    );
    const uniqueSlots = new Set(slots);
    if (uniqueSlots.size !== slots.length) {
      return err('a player cannot appear more than once in the same game', 400);
    }

    const idsToCheck = [...uniqueSlots];
    if (idsToCheck.length > 0) {
      const placeholders = idsToCheck.map(() => '?').join(', ');
      const { results: foundPlayers } = await env.DB.prepare(
        `SELECT id FROM players WHERE id IN (${placeholders})`
      )
        .bind(...idsToCheck)
        .all();
      const foundIds = new Set((foundPlayers || []).map((p) => p.id));
      const missing = idsToCheck.filter((pid) => !foundIds.has(pid));
      if (missing.length > 0) {
        return err(`unknown player id(s): ${missing.join(', ')}`, 400);
      }
    }

    await env.DB.prepare(
      `UPDATE games SET a1 = ?, a2 = ?, b1 = ?, b2 = ?, winner = ?, score_text = ?, position = ?
       WHERE id = ?`
    )
      .bind(
        merged.a1,
        merged.a2,
        merged.b1,
        merged.b2,
        merged.winner,
        merged.score_text,
        merged.position,
        id
      )
      .run();

    const updated = await env.DB.prepare(
      'SELECT id, session_id, position, a1, a2, b1, b2, winner, score_text FROM games WHERE id = ?'
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

    const existing = await env.DB.prepare('SELECT id FROM games WHERE id = ?').bind(id).first();
    if (!existing) return err('game not found', 404);

    await env.DB.prepare('DELETE FROM games WHERE id = ?').bind(id).run();

    return ok({ id });
  } catch (e) {
    return err(e.message, 500);
  }
}
