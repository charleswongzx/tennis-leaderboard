// GET /api/leaderboard (public)
import { ok, err } from './_lib.js';

export async function onRequestGet(context) {
  const { env } = context;
  try {
    const [playersRes, pointsAggRes, gamesRes, sessionsRes, spRes] = await env.DB.batch([
      env.DB.prepare('SELECT id, name, emoji, tagline, created_at, deleted_at FROM players'),
      env.DB.prepare(
        `SELECT player_id, SUM(points) AS total, COUNT(DISTINCT session_id) AS attended
         FROM session_points GROUP BY player_id`
      ),
      env.DB.prepare('SELECT id, session_id, a1, a2, b1, b2, winner FROM games'),
      env.DB.prepare(
        `SELECT s.id, s.date, s.title, s.notes,
                (SELECT COUNT(*) FROM games g WHERE g.session_id = s.id) AS game_count,
                (SELECT COUNT(*) FROM session_points sp WHERE sp.session_id = s.id) AS player_count
         FROM sessions s
         ORDER BY s.date DESC, s.id DESC`
      ),
      // Raw session_points rows, needed (alongside the aggregate above) for streak/last_played.
      env.DB.prepare('SELECT session_id, player_id, points FROM session_points'),
    ]);

    const players = playersRes.results || [];
    const pointsAgg = pointsAggRes.results || [];
    const games = gamesRes.results || [];
    const sessionsRows = sessionsRes.results || [];
    const sp = spRes.results || [];

    const pointsByPlayer = new Map(pointsAgg.map((r) => [r.player_id, r]));

    // games_played / games_won per player
    const gamesPlayed = new Map();
    const gamesWon = new Map();
    const bump = (map, id, n = 1) => map.set(id, (map.get(id) || 0) + n);
    for (const g of games) {
      const sides = [
        { id: g.a1, side: 'A' },
        { id: g.a2, side: 'A' },
        { id: g.b1, side: 'B' },
        { id: g.b2, side: 'B' },
      ];
      for (const { id, side } of sides) {
        if (id === null || id === undefined) continue;
        bump(gamesPlayed, id, 1);
        if (side === g.winner) bump(gamesWon, id, 1);
      }
    }

    // sessions sorted date DESC (with id as tiebreak, matching sessionsRows order)
    const sessionsSortedDesc = [...sessionsRows];

    // player_id -> set of session_ids they have a points row for
    const sessionIdsByPlayer = new Map();
    for (const row of sp) {
      if (!sessionIdsByPlayer.has(row.player_id)) sessionIdsByPlayer.set(row.player_id, new Set());
      sessionIdsByPlayer.get(row.player_id).add(row.session_id);
    }

    // player_id -> last played date (max date where they have a points row)
    const lastPlayedByPlayer = new Map();
    for (const row of sp) {
      const session = sessionsRows.find((s) => s.id === row.session_id);
      if (!session) continue;
      const cur = lastPlayedByPlayer.get(row.player_id);
      if (!cur || session.date > cur) lastPlayedByPlayer.set(row.player_id, session.date);
    }

    function computeStreak(playerId) {
      const ids = sessionIdsByPlayer.get(playerId);
      if (!ids || ids.size === 0) return 0;
      let streak = 0;
      for (const session of sessionsSortedDesc) {
        if (ids.has(session.id)) {
          streak += 1;
        } else {
          break;
        }
      }
      return streak;
    }

    // Determine which players have any session_points history
    const playersWithHistory = new Set(sp.map((r) => r.player_id));

    const assembledPlayers = [];
    for (const p of players) {
      const isDeleted = !!p.deleted_at;
      if (isDeleted && !playersWithHistory.has(p.id)) {
        continue; // omit deleted players with no history
      }
      const agg = pointsByPlayer.get(p.id);
      assembledPlayers.push({
        id: p.id,
        name: p.name,
        emoji: p.emoji,
        tagline: p.tagline,
        deleted: isDeleted,
        total_points: agg ? agg.total : 0,
        sessions_attended: agg ? agg.attended : 0,
        games_played: gamesPlayed.get(p.id) || 0,
        games_won: gamesWon.get(p.id) || 0,
        current_streak: computeStreak(p.id),
        last_played: lastPlayedByPlayer.get(p.id) || null,
      });
    }

    assembledPlayers.sort((a, b) => {
      if (b.total_points !== a.total_points) return b.total_points - a.total_points;
      return a.name.localeCompare(b.name);
    });

    const sessions = sessionsRows.map((s) => ({
      id: s.id,
      date: s.date,
      title: s.title,
      notes: s.notes,
      game_count: s.game_count,
      player_count: s.player_count,
    }));

    return ok({ players: assembledPlayers, sessions });
  } catch (e) {
    return err(e.message, 500);
  }
}
