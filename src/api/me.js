// GET /api/me  -> { umpire: boolean }
import { ok } from './_lib.js';
import { isUmpire } from './_auth.js';

export async function onRequestGet({ request, env }) {
  return ok({ umpire: await isUmpire(request, env) });
}
