/* Blitz 95 — PREVIEW mock API.
   Replaces js/api.js in the standalone preview build: same async interface,
   backed by an in-browser store persisted to localStorage. */
window.Blitz = window.Blitz || { pages: {} };
window.BLITZ_PREVIEW = true;

(function () {
  var DB_KEY = 'blitz95_preview_db_v1';

  function seedDb() {
    return {
      nextId: 100,
      players: [
        { id: 1, name: "Serena's Stunt Double", emoji: '🦁', tagline: 'Growling at my own shadows', deleted_at: null },
        { id: 2, name: 'The Racket Scientist', emoji: '🧬', tagline: 'DNA strain: 80% sweat', deleted_at: null },
        { id: 3, name: 'Net Prophet', emoji: '🔮', tagline: "They said I'd never hit a backhand", deleted_at: null },
        { id: 4, name: 'Baseline Karen', emoji: '👑', tagline: 'Your court, my rules', deleted_at: null },
        { id: 5, name: 'Volley Llama', emoji: '🦙', tagline: 'I spit when I miss', deleted_at: null }
      ],
      sessions: [
        { id: 1, date: '2026-06-27', title: 'Sunday Slamdown', notes: 'Weather was perfect, arguments were not' },
        { id: 2, date: '2026-07-05', title: 'Independence Day Doubles Chaos', notes: null },
        { id: 3, date: '2026-07-12', title: 'Midweek Madness', notes: 'Dave brought the bad balls again' }
      ],
      games: [
        { id: 1, session_id: 1, position: 1, a1: 1, a2: null, b1: 2, b2: null, winner: 'A', score_text: '6-4' },
        { id: 2, session_id: 1, position: 2, a1: 3, a2: 4, b1: 2, b2: 5, winner: 'B', score_text: '7-5' },
        { id: 3, session_id: 1, position: 3, a1: 1, a2: null, b1: 3, b2: null, winner: 'B', score_text: '3-6' },
        { id: 4, session_id: 1, position: 4, a1: 4, a2: 5, b1: 1, b2: 2, winner: 'A', score_text: 'they gave up' },
        { id: 5, session_id: 2, position: 1, a1: 1, a2: 2, b1: 3, b2: 4, winner: 'A', score_text: '6-4' },
        { id: 6, session_id: 2, position: 2, a1: 5, a2: null, b1: 1, b2: null, winner: 'B', score_text: '7-6' },
        { id: 7, session_id: 2, position: 3, a1: 3, a2: 5, b1: 2, b2: 4, winner: 'B', score_text: '6-3' },
        { id: 8, session_id: 2, position: 4, a1: 1, a2: null, b1: 4, b2: null, winner: 'A', score_text: '6-1' },
        { id: 9, session_id: 2, position: 5, a1: 2, a2: 3, b1: 4, b2: 5, winner: 'A', score_text: '7-5' },
        { id: 10, session_id: 3, position: 1, a1: 1, a2: null, b1: 2, b2: null, winner: 'A', score_text: '6-0' },
        { id: 11, session_id: 3, position: 2, a1: 3, a2: 4, b1: 5, b2: 1, winner: 'B', score_text: '5-7' },
        { id: 12, session_id: 3, position: 3, a1: 2, a2: null, b1: 3, b2: null, winner: 'B', score_text: '4-6' },
        { id: 13, session_id: 3, position: 4, a1: 4, a2: 5, b1: 1, b2: 2, winner: 'A', score_text: '6-4' },
        { id: 14, session_id: 3, position: 5, a1: 1, a2: 3, b1: 4, b2: 5, winner: 'B', score_text: '3-6' },
        { id: 15, session_id: 3, position: 6, a1: 2, a2: null, b1: 4, b2: null, winner: 'A', score_text: '6-2' }
      ],
      session_points: [
        { session_id: 1, player_id: 1, points: 8 }, { session_id: 1, player_id: 2, points: 6 },
        { session_id: 1, player_id: 3, points: 5 }, { session_id: 1, player_id: 4, points: 7 },
        { session_id: 1, player_id: 5, points: 4 },
        { session_id: 2, player_id: 1, points: 9 }, { session_id: 2, player_id: 2, points: 5 },
        { session_id: 2, player_id: 3, points: 6 }, { session_id: 2, player_id: 4, points: 3 },
        { session_id: 2, player_id: 5, points: 7 },
        { session_id: 3, player_id: 1, points: 10 }, { session_id: 3, player_id: 2, points: 6 },
        { session_id: 3, player_id: 3, points: 5 }, { session_id: 3, player_id: 4, points: 8 },
        { session_id: 3, player_id: 5, points: 4 }
      ]
    };
  }

  var db;
  try { db = JSON.parse(localStorage.getItem(DB_KEY)) || seedDb(); }
  catch (e) { db = seedDb(); }

  function save() {
    try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch (e) { /* incognito, whatever */ }
  }

  function resetPreviewDb() {
    db = seedDb();
    save();
  }

  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function nextId() { return db.nextId++; }
  function byName(a, b) { return a.name.localeCompare(b.name); }
  function fail(msg) { var e = new Error(msg); e.status = 400; throw e; }

  function playerRow(p) {
    return { id: p.id, name: p.name, emoji: p.emoji, tagline: p.tagline, deleted: !!p.deleted_at };
  }

  function findPlayer(id) {
    var p = db.players.filter(function (x) { return x.id === id; })[0];
    if (!p) { var e = new Error('player not found'); e.status = 404; throw e; }
    return p;
  }

  function findSession(id) {
    var s = db.sessions.filter(function (x) { return x.id === id; })[0];
    if (!s) { var e = new Error('session not found'); e.status = 404; throw e; }
    return s;
  }

  function sessionSummary(s) {
    return {
      id: s.id, date: s.date, title: s.title, notes: s.notes,
      game_count: db.games.filter(function (g) { return g.session_id === s.id; }).length,
      player_count: db.session_points.filter(function (r) { return r.session_id === s.id; }).length
    };
  }

  function sortedSessions() {
    return db.sessions.slice().sort(function (a, b) { return b.date < a.date ? -1 : b.date > a.date ? 1 : b.id - a.id; });
  }

  function validateGame(body) {
    if (!Number.isInteger(body.a1) || !Number.isInteger(body.b1)) fail('each side needs a first player');
    if (body.winner !== 'A' && body.winner !== 'B') fail('winner must be A or B');
    var ids = [body.a1, body.a2, body.b1, body.b2].filter(function (x) { return x != null; });
    ids.forEach(function (id) { findPlayer(id); });
    if (new Set(ids).size !== ids.length) fail('a player cannot appear more than once in the same game');
  }

  function leaderboard() {
    var totals = {}, attended = {}, sessionsByPlayer = {};
    db.session_points.forEach(function (r) {
      totals[r.player_id] = (totals[r.player_id] || 0) + r.points;
      attended[r.player_id] = (attended[r.player_id] || 0) + 1;
      (sessionsByPlayer[r.player_id] = sessionsByPlayer[r.player_id] || {})[r.session_id] = true;
    });
    var played = {}, won = {};
    db.games.forEach(function (g) {
      [['A', g.a1], ['A', g.a2], ['B', g.b1], ['B', g.b2]].forEach(function (pair) {
        if (pair[1] == null) return;
        played[pair[1]] = (played[pair[1]] || 0) + 1;
        if (pair[0] === g.winner) won[pair[1]] = (won[pair[1]] || 0) + 1;
      });
    });
    var chrono = sortedSessions();
    var players = db.players
      .filter(function (p) { return !p.deleted_at || totals[p.id] !== undefined; })
      .map(function (p) {
        var streak = 0;
        for (var i = 0; i < chrono.length; i++) {
          if (sessionsByPlayer[p.id] && sessionsByPlayer[p.id][chrono[i].id]) streak++;
          else break;
        }
        var lastPlayed = null;
        chrono.forEach(function (s) {
          if (sessionsByPlayer[p.id] && sessionsByPlayer[p.id][s.id] && (!lastPlayed || s.date > lastPlayed)) lastPlayed = s.date;
        });
        return {
          id: p.id, name: p.name, emoji: p.emoji, tagline: p.tagline, deleted: !!p.deleted_at,
          total_points: totals[p.id] || 0,
          sessions_attended: attended[p.id] || 0,
          games_played: played[p.id] || 0,
          games_won: won[p.id] || 0,
          current_streak: streak,
          last_played: lastPlayed
        };
      })
      .sort(function (a, b) { return b.total_points - a.total_points || a.name.localeCompare(b.name); });
    return { players: players, sessions: sortedSessions().map(sessionSummary) };
  }

  /* ---- the api() replacement: same signature, ~40ms of fake latency ---- */

  async function api(path, opts) {
    opts = opts || {};
    var method = opts.method || 'GET';
    var body = opts.body;
    await new Promise(function (r) { setTimeout(r, 40); });

    var qs = path.indexOf('?') >= 0 ? path.slice(path.indexOf('?') + 1) : '';
    var p = (path.indexOf('?') >= 0 ? path.slice(0, path.indexOf('?')) : path).replace(/\/+$/, '');
    var m;

    if (p === '/leaderboard' && method === 'GET') return leaderboard();

    if (p === '/players') {
      if (method === 'GET') {
        var all = /(^|&)all=1/.test(qs);
        return db.players
          .filter(function (x) { return all || !x.deleted_at; })
          .slice().sort(byName).map(playerRow);
      }
      if (method === 'POST') {
        if (!body || !body.name || !String(body.name).trim()) fail('name is required');
        var np = { id: nextId(), name: String(body.name).trim(), emoji: body.emoji || '🎾', tagline: body.tagline || null, deleted_at: null };
        db.players.push(np); save();
        return playerRow(np);
      }
    }

    if ((m = p.match(/^\/players\/(\d+)$/))) {
      var pl = findPlayer(Number(m[1]));
      if (method === 'PUT') {
        if (body.restore) pl.deleted_at = null;
        if (body.name !== undefined) pl.name = String(body.name).trim() || pl.name;
        if (body.emoji !== undefined) pl.emoji = body.emoji || '🎾';
        if (body.tagline !== undefined) pl.tagline = body.tagline;
        save(); return playerRow(pl);
      }
      if (method === 'DELETE') { pl.deleted_at = 'now'; save(); return { id: pl.id }; }
    }

    if (p === '/sessions') {
      if (method === 'GET') return sortedSessions().map(sessionSummary);
      if (method === 'POST') {
        if (!body || !/^\d{4}-\d{2}-\d{2}$/.test(body.date || '')) fail('date must be YYYY-MM-DD');
        var ns = { id: nextId(), date: body.date, title: body.title || null, notes: body.notes || null };
        db.sessions.push(ns); save();
        return clone(ns);
      }
    }

    if ((m = p.match(/^\/sessions\/(\d+)$/))) {
      var s = findSession(Number(m[1]));
      if (method === 'GET') {
        var games = db.games.filter(function (g) { return g.session_id === s.id; })
          .sort(function (a, b) { return a.position - b.position || a.id - b.id; });
        var points = db.session_points.filter(function (r) { return r.session_id === s.id; });
        var refIds = {};
        games.forEach(function (g) { [g.a1, g.a2, g.b1, g.b2].forEach(function (id) { if (id != null) refIds[id] = true; }); });
        points.forEach(function (r) { refIds[r.player_id] = true; });
        var players = db.players
          .filter(function (x) { return !x.deleted_at || refIds[x.id]; })
          .slice().sort(byName).map(playerRow);
        return { session: clone(s), games: clone(games), points: clone(points), players: players };
      }
      if (method === 'PUT') {
        if (body.date !== undefined) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date || '')) fail('date must be YYYY-MM-DD');
          s.date = body.date;
        }
        if (body.title !== undefined) s.title = body.title;
        if (body.notes !== undefined) s.notes = body.notes;
        save(); return clone(s);
      }
      if (method === 'DELETE') {
        db.sessions = db.sessions.filter(function (x) { return x.id !== s.id; });
        db.games = db.games.filter(function (g) { return g.session_id !== s.id; });
        db.session_points = db.session_points.filter(function (r) { return r.session_id !== s.id; });
        save(); return { id: s.id };
      }
    }

    if ((m = p.match(/^\/sessions\/(\d+)\/games$/)) && method === 'POST') {
      var gs = findSession(Number(m[1]));
      validateGame(body);
      var maxPos = db.games.filter(function (g) { return g.session_id === gs.id; })
        .reduce(function (mx, g) { return Math.max(mx, g.position); }, 0);
      var ng = {
        id: nextId(), session_id: gs.id, position: maxPos + 1,
        a1: body.a1, a2: body.a2 || null, b1: body.b1, b2: body.b2 || null,
        winner: body.winner, score_text: body.score_text || null
      };
      db.games.push(ng); save();
      return clone(ng);
    }

    if ((m = p.match(/^\/sessions\/(\d+)\/points$/)) && method === 'PUT') {
      var ps = findSession(Number(m[1]));
      if (!body || !Array.isArray(body.points)) fail('points array required');
      var seen = {};
      body.points.forEach(function (r) {
        if (!Number.isInteger(r.player_id) || !Number.isInteger(r.points)) fail('points must be whole numbers');
        if (seen[r.player_id]) fail('duplicate player in points');
        seen[r.player_id] = true;
        findPlayer(r.player_id);
      });
      db.session_points = db.session_points.filter(function (r) { return r.session_id !== ps.id; })
        .concat(body.points.map(function (r) { return { session_id: ps.id, player_id: r.player_id, points: r.points }; }));
      save();
      return clone(body.points);
    }

    if ((m = p.match(/^\/games\/(\d+)$/))) {
      var gid = Number(m[1]);
      var game = db.games.filter(function (g) { return g.id === gid; })[0];
      if (!game) { var e404 = new Error('game not found'); e404.status = 404; throw e404; }
      if (method === 'PUT') {
        var merged = clone(game);
        ['a1', 'a2', 'b1', 'b2', 'winner', 'score_text', 'position'].forEach(function (k) {
          if (body[k] !== undefined) merged[k] = body[k];
        });
        validateGame(merged);
        Object.assign(game, merged); save();
        return clone(game);
      }
      if (method === 'DELETE') {
        db.games = db.games.filter(function (g) { return g.id !== gid; });
        save(); return { id: gid };
      }
    }

    fail('preview: no such endpoint ' + method + ' ' + path);
  }

  window.Blitz.api = api;
  window.Blitz.getAdminKey = function () { return 'preview-mode'; };
  window.Blitz.setAdminKey = function () {};
  window.Blitz.captureAdminKeyFromUrl = function () { return 'preview-mode'; };
  window.Blitz.resetPreviewDb = resetPreviewDb;
})();
