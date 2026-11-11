// POST /api/login  { password }  -> sets the umpire cookie
import { ok, err, readJson } from './_lib.js';
import { passwordMatches, makeToken, cookieHeader, MAX_AGE_S } from './_auth.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  if (!body || !passwordMatches(env, body.password)) {
    // a small delay makes guessing slower without bothering real umpires
    await new Promise((r) => setTimeout(r, 400));
    return err('wrong password', 401);
  }
  const res = ok({ umpire: true });
  res.headers.append('Set-Cookie', cookieHeader(request, await makeToken(env), MAX_AGE_S));
  return res;
}
