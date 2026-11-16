// Creates the database tables on first use, so a fresh deploy needs no manual setup,
// then adds any built-in historical results that have not been added yet.
// Statements come from /schema.sql (bundled as text, see [[rules]] in wrangler.toml).
import SCHEMA from '../../schema.sql';
import { seedStatements } from './_seeds.js';

const STATEMENTS = SCHEMA
  .replace(/--.*$/gm, '')
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean);

let ready = null;

export function ensureSchema(env) {
  if (!ready) {
    const statements = STATEMENTS.map((s) => env.DB.prepare(s)).concat(seedStatements(env.DB));
    ready = env.DB.batch(statements).catch((e) => {
      ready = null; // try again on the next request
      throw e;
    });
  }
  return ready;
}
