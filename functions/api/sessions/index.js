// GET  /api/sessions   (public)
// POST /api/sessions   (admin)
import { ok, err, readJson, isValidDate } from '../_lib.js';

export async function onRequestGet(context) {
  const { env } = context;
  try {
    const { results } = await env.DB.prepare(
      `SELECT s.id, s.date, s.title, s.notes,
              (SELECT COUNT(*) FROM games g WHERE g.session_id = s.id) AS game_count,
              (SELECT COUNT(*) FROM session_points sp WHERE sp.session_id = s.id) AS player_count
       FROM sessions s
       ORDER BY s.date DESC, s.id DESC`
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
    if (!body || !isValidDate(body.date)) {
      return err('date is required and must be in YYYY-MM-DD format', 400);
    }
    const title = typeof body.title === 'string' ? body.title : null;
    const notes = typeof body.notes === 'string' ? body.notes : null;

    const insert = await env.DB.prepare(
      'INSERT INTO sessions (date, title, notes) VALUES (?, ?, ?)'
    )
      .bind(body.date, title, notes)
      .run();

    const id = insert.meta.last_row_id;
    const row = await env.DB.prepare(
      'SELECT id, date, title, notes, created_at FROM sessions WHERE id = ?'
    )
      .bind(id)
      .first();

    return ok(row, { status: 201 });
  } catch (e) {
    return err(e.message, 500);
  }
}
