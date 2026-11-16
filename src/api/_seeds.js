// Results from before this site existed, added to the Roll of Champions once.
// Each seed is inserted the first time the Worker starts with it, then recorded in
// the `seeds` table, so it never comes back if an umpire later deletes it.

export const SEEDS = [
  {
    // Played 2026-11-09 on the earlier claude.ai scoreboard; final standings copied from it.
    key: 'chiang-mai-open-2026',
    event: {
      kind: 'scoreboard',
      title: 'Chiang Mai Open 2026',
      date: '2026-11-09',
      status: 'finished',
      winner: '🦀 Berton',
      data: {
        players: [
          { id: 'p1', name: 'Berton', emoji: '🦀' },
          { id: 'p2', name: 'Charles', emoji: '🤖' },
          { id: 'p3', name: 'Chris', emoji: '🌶️' },
          { id: 'p4', name: 'Jordy', emoji: '🦄' },
          { id: 'p5', name: 'Wei han', emoji: '🦖' },
          { id: 'p6', name: 'Raph', emoji: '🎾' },
          { id: 'p7', name: 'Jarod', emoji: '🦩' },
          { id: 'p8', name: 'JR', emoji: '🧀' },
          { id: 'p9', name: 'Gloria', emoji: '🐙' },
          { id: 'p10', name: 'Cherie', emoji: '🥑' },
        ],
        scores: { p1: 12, p2: 7, p3: 8, p4: 8, p5: 8, p6: 10, p7: 8, p8: 9, p9: 8, p10: 11 },
      },
    },
  },
];

/** Statements that add every seed not yet applied (one transaction with the schema). */
export function seedStatements(db) {
  const out = [];
  for (const { key, event } of SEEDS) {
    out.push(
      db.prepare(
        `INSERT INTO events (kind, title, date, status, winner, data)
         SELECT ?, ?, ?, ?, ?, ?
         WHERE NOT EXISTS (SELECT 1 FROM seeds WHERE key = ?)`
      ).bind(event.kind, event.title, event.date, event.status, event.winner, JSON.stringify(event.data), key),
      db.prepare('INSERT OR IGNORE INTO seeds (key) VALUES (?)').bind(key)
    );
  }
  return out;
}
