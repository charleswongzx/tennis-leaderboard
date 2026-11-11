// POST /api/logout  -> clears the umpire cookie
import { ok } from './_lib.js';
import { cookieHeader } from './_auth.js';

export async function onRequestPost({ request }) {
  const res = ok({ umpire: false });
  res.headers.append('Set-Cookie', cookieHeader(request, '', 0));
  return res;
}
