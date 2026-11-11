// Creates the database table on first use, so a fresh deploy needs no manual setup.
// Statements come from /schema.sql (bundled as text, see [[rules]] in wrangler.toml).
import SCHEMA from '../../schema.sql';

const STATEMENTS = SCHEMA
  .replace(/--.*$/gm, '')
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean);

let ready = null;

export function ensureSchema(env) {
  if (!ready) {
    ready = env.DB.batch(STATEMENTS.map((s) => env.DB.prepare(s))).catch((e) => {
      ready = null; // try again on the next request
      throw e;
    });
  }
  return ready;
}
