// GET    /api/events/:id[?v=N]  (public)  full event; with ?v equal to the current
//                                         version, answers { unchanged: true } (cheap polling)
// PUT    /api/events/:id        (umpire)  { version, title?, date?, status?, winner?, data? }
//                                         409 with the current event when version is stale
// DELETE /api/events/:id        (umpire)
import { ok, err, readJson, parseId, isValidDate } from '../_lib.js';
import { STATUSES, LIST_COLUMNS, rowToEvent, cleanTitle, cleanWinner, serializeData } from '../_events.js';

async function load(env, id) {
  return env.DB.prepare(`SELECT ${LIST_COLUMNS}, data FROM events WHERE id = ?`).bind(id).first();
}

export async function onRequestGet({ params, request, env }) {
  const id = parseId(params.id);
  if (!id) return err('bad event id');
  try {
    const v = new URL(request.url).searchParams.get('v');
    if (v !== null) {
      const row = await env.DB.prepare('SELECT version FROM events WHERE id = ?').bind(id).first();
      if (!row) return err('event not found', 404);
      if (String(row.version) === v) return ok({ unchanged: true, version: row.version });
    }
    const row = await load(env, id);
    if (!row) return err('event not found', 404);
    return ok(rowToEvent(row, true));
  } catch (e) {
    return err(e.message, 500);
  }
}

export async function onRequestPut({ params, request, env }) {
  const id = parseId(params.id);
  if (!id) return err('bad event id');
  const body = await readJson(request);
  if (!body || !Number.isInteger(body.version)) return err('expected { version, ... }');

  try {
    const cur = await load(env, id);
    if (!cur) return err('event not found', 404);
    if (cur.version !== body.version) return err('conflict', 409, rowToEvent(cur, true));

    let title = cur.title, date = cur.date, status = cur.status, winner = cur.winner, data = cur.data;
    if (body.title !== undefined) {
      title = cleanTitle(body.title);
      if (!title) return err('every event needs a title');
    }
    if (body.date !== undefined) {
      if (!isValidDate(body.date)) return err('date must be YYYY-MM-DD');
      date = body.date;
    }
    if (body.status !== undefined) {
      if (!STATUSES.has(body.status)) return err('status must be live or finished');
      status = body.status;
    }
    if (body.winner !== undefined) {
      winner = cleanWinner(body.winner);
      if (winner === undefined) return err('winner must be a string or null');
    }
    if (body.data !== undefined) {
      const ser = serializeData(body.data);
      if (ser.error) return err(ser.error);
      data = ser.json;
    }

    const row = await env.DB.prepare(
      `UPDATE events
          SET title = ?, date = ?, status = ?, winner = ?, data = ?,
              version = version + 1, updated_at = datetime('now')
        WHERE id = ? AND version = ?
        RETURNING ${LIST_COLUMNS}, data`
    ).bind(title, date, status, winner, data, id, body.version).first();

    if (!row) {
      // someone else saved between our read and write
      const latest = await load(env, id);
      return err('conflict', 409, rowToEvent(latest, true));
    }
    return ok(rowToEvent(row, true));
  } catch (e) {
    return err(e.message, 500);
  }
}

export async function onRequestDelete({ params, env }) {
  const id = parseId(params.id);
  if (!id) return err('bad event id');
  try {
    await env.DB.prepare('DELETE FROM events WHERE id = ?').bind(id).run();
    return ok({ deleted: id });
  } catch (e) {
    return err(e.message, 500);
  }
}
