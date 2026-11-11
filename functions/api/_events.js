// Shared validation and row mapping for /api/events routes.

export const KINDS = new Set(['scoreboard', 'tournament']);
export const STATUSES = new Set(['live', 'finished']);
export const MAX_DATA_BYTES = 200 * 1024;

export const LIST_COLUMNS = 'id, kind, title, date, status, winner, version, created_at, updated_at';

export function rowToEvent(row, withData) {
  if (!row) return null;
  const ev = {
    id: row.id,
    kind: row.kind,
    title: row.title,
    date: row.date,
    status: row.status,
    winner: row.winner,
    version: row.version,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
  if (withData) {
    try { ev.data = JSON.parse(row.data || '{}'); } catch { ev.data = {}; }
  }
  return ev;
}

export function cleanTitle(v) {
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, ' ').trim().slice(0, 80);
  return t || null;
}

export function cleanWinner(v) {
  if (v === null) return null;
  if (typeof v !== 'string') return undefined;
  return v.trim().slice(0, 200) || null;
}

/** Returns the JSON string for a data object, or an error message. */
export function serializeData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { error: 'data must be an object' };
  const json = JSON.stringify(data);
  if (json.length > MAX_DATA_BYTES) return { error: 'event data is too large' };
  return { json };
}
