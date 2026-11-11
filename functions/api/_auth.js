// Umpire (editor) login: one shared password, exchanged for a signed cookie.
//
// The password comes from the EDIT_PASSWORD variable (wrangler.toml [vars] or a
// Pages secret). The cookie holds "<expiry>.<HMAC(expiry)>", signed with
// SESSION_SECRET when set, otherwise with a key derived from the password, so
// changing the password logs every device out.

export const COOKIE = 'weembledon_umpire';
const MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days

const enc = new TextEncoder();

export function editPassword(env) {
  return String(env.EDIT_PASSWORD || 'Blitzy');
}

function signingSecret(env) {
  return env.SESSION_SECRET ? String(env.SESSION_SECRET) : 'pw:' + editPassword(env);
}

function b64url(buf) {
  let s = '';
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
}

/** Constant-time string comparison. */
export function safeEqual(a, b) {
  a = String(a); b = String(b);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/** Friendly check: ignores surrounding spaces and letter case (phones love to capitalise). */
export function passwordMatches(env, attempt) {
  return safeEqual(String(attempt ?? '').trim().toLowerCase(), editPassword(env).trim().toLowerCase());
}

export async function makeToken(env) {
  const exp = Date.now() + MAX_AGE_S * 1000;
  return exp + '.' + (await hmac(signingSecret(env), 'umpire:' + exp));
}

export async function verifyToken(env, token) {
  if (!token || typeof token !== 'string') return false;
  const dot = token.indexOf('.');
  if (dot < 1) return false;
  const exp = Number(token.slice(0, dot));
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = await hmac(signingSecret(env), 'umpire:' + exp);
  return safeEqual(token.slice(dot + 1), expected);
}

export function readCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > -1 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

export async function isUmpire(request, env) {
  return verifyToken(env, readCookie(request, COOKIE));
}

export function cookieHeader(request, value, maxAge) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

export { MAX_AGE_S };
