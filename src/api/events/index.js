// GET  /api/events   (public)  list of events, newest first, without their data
// POST /api/events   (umpire)  { kind, title, date, data? } -> created event
import { ok, err, readJson, isValidDate } from '../_lib.js';
import { KINDS, LIST_COLUMNS, rowToEvent, cleanTitle, serializeData } from '../_events.js';

export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT ${LIST_COLUMNS} FROM events ORDER BY date DESC, id DESC LIMIT 200`
    ).all();
    return ok((results || []).map((r) => rowToEvent(r, false)));
  } catch (e) {
    return err(e.message, 500);
  }
}

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  if (!body) return err('expected a JSON body');
  if (!KINDS.has(body.kind)) return err('kind must be scoreboard or tournament');
  const title = cleanTitle(body.title);
  if (!title) return err('every event needs a title');
  if (!isValidDate(body.date)) return err('date must be YYYY-MM-DD');
  const ser = serializeData(body.data === undefined ? {} : body.data);
  if (ser.error) return err(ser.error);

  try {
    const row = await env.DB.prepare(
      `INSERT INTO events (kind, title, date, data) VALUES (?, ?, ?, ?)
       RETURNING ${LIST_COLUMNS}, data`
    ).bind(body.kind, title, body.date, ser.json).first();
    return ok(rowToEvent(row, true), { status: 201 });
  } catch (e) {
    return err(e.message, 500);
  }
}
