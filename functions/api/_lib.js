// Shared helpers for API route handlers.
// Underscore-prefixed files are not routed by Cloudflare Pages Functions.

/** Build a successful JSON response: { ok: true, data } */
export function ok(data, init) {
  return Response.json({ ok: true, data }, init);
}

/** Build an error JSON response: { ok: false, error } */
export function err(message, status = 400) {
  return Response.json({ ok: false, error: message }, { status });
}

/**
 * Parse a route param (string) into a positive integer id.
 * Returns null if it is not a valid integer.
 */
export function parseId(str) {
  if (str === undefined || str === null || str === '') return null;
  if (!/^-?\d+$/.test(String(str))) return null;
  const n = Number(str);
  if (!Number.isInteger(n)) return null;
  return n;
}

/**
 * Safely parse a JSON request body. Returns null on failure or empty body.
 */
export async function readJson(request) {
  try {
    const text = await request.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** YYYY-MM-DD validation */
export function isValidDate(str) {
  return typeof str === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(str);
}
