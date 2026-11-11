/*
 * formats.js - pure logic engine for tournament schedules, results and standings.
 *
 * No DOM, no dependencies, no module syntax. Browser: window.BlitzFormats. Node: module.exports.
 * Tournament `data` is plain JSON; every function either returns derived values or mutates
 * and returns the `data` object it was given.
 */
(function (root) {
  'use strict';

  // ---------------------------------------------------------------------------
  // Metadata
  // ---------------------------------------------------------------------------

  var FORMATS = [
    {
      key: 'round_robin',
      label: 'Round robin',
      modes: ['singles', 'doubles'],
      minPlayers: 2,
      blurb: 'Everyone plays everyone once, so nobody gets knocked out and everyone gets plenty of tennis.'
    },
    {
      key: 'americano',
      label: 'Rotating partners',
      modes: ['doubles'],
      minPlayers: 4,
      blurb: 'You get a new partner every round and the most games won wins, so it is a great mixer.'
    },
    {
      key: 'knockout',
      label: 'Knockout',
      modes: ['singles', 'doubles'],
      minPlayers: 2,
      blurb: 'Win and you go through, lose and you are out, with byes if the numbers do not fit neatly.'
    },
    {
      key: 'pools_playoff',
      label: 'Round robin + playoffs',
      modes: ['singles', 'doubles'],
      minPlayers: 3,
      blurb: 'Everyone plays everyone, then the top 2, 4 or 8 go into a knockout to crown a champion.'
    }
  ];

  // ---------------------------------------------------------------------------
  // Small helpers
  // ---------------------------------------------------------------------------

  function getRng(rng) {
    return typeof rng === 'function' ? rng : Math.random;
  }

  // Fisher-Yates, returns a new array.
  function shuffled(arr, rng) {
    var r = getRng(rng);
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(r() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // Identity of a side: sorted player ids joined.
  function sideKey(ids) {
    return (ids || []).slice().sort().join('+');
  }

  function isInt(x) {
    return typeof x === 'number' && isFinite(x) && Math.floor(x) === x;
  }

  function findMatch(data, id) {
    for (var i = 0; i < data.matches.length; i++) {
      if (data.matches[i].id === id) return data.matches[i];
    }
    return null;
  }

  function addMatch(data, props) {
    var m = { id: 'm' + data.nextId };
    data.nextId += 1;
    for (var k in props) if (Object.prototype.hasOwnProperty.call(props, k)) m[k] = props[k];
    if (m.score === undefined) m.score = null;
    data.matches.push(m);
    return m;
  }

  function usesFixedTeams(data) {
    return data.mode === 'doubles' && data.format !== 'americano';
  }

  // ---------------------------------------------------------------------------
  // Teams
  // ---------------------------------------------------------------------------

  function makeTeams(playerIds, shuffle, rng) {
    if (playerIds.length % 2 !== 0) {
      throw new Error('Doubles needs an even number of players for fixed teams');
    }
    var ids = shuffle ? shuffled(playerIds, rng) : playerIds.slice();
    var teams = [];
    for (var i = 0; i < ids.length; i += 2) {
      teams.push({ id: 't' + (teams.length + 1), players: [ids[i], ids[i + 1]] });
    }
    return teams;
  }

  // ---------------------------------------------------------------------------
  // Round robin (circle method)
  // ---------------------------------------------------------------------------

  // entrants: [{ players: [pid...] }]. Returns a list of rounds, each a list of [entrantA, entrantB].
  function circleRounds(entrants) {
    var arr = entrants.slice();
    if (arr.length % 2 === 1) arr.push(null); // phantom bye: whoever meets null rests
    var n = arr.length;
    var out = [];
    for (var r = 0; r < n - 1; r++) {
      var pairs = [];
      for (var i = 0; i < n / 2; i++) {
        var x = arr[i], y = arr[n - 1 - i];
        if (x && y) pairs.push([x, y]);
      }
      out.push(pairs);
      // keep arr[0] fixed, rotate the rest one step
      arr.splice(1, 0, arr.pop());
    }
    return out;
  }

  // Splits circle rounds so no round has more than `courts` matches, then numbers rounds.
  function addRoundRobinMatches(data, entrants, courts) {
    var roundNo = 0;
    circleRounds(entrants).forEach(function (pairs) {
      for (var i = 0; i < pairs.length; i += courts) {
        roundNo += 1;
        pairs.slice(i, i + courts).forEach(function (p, idx) {
          addMatch(data, {
            stage: 'rr', round: roundNo, court: idx + 1, slot: idx,
            a: p[0].players.slice(), b: p[1].players.slice()
          });
        });
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Americano (rotating partners)
  // ---------------------------------------------------------------------------

  /*
   * suggestRounds(n, courts): number of rounds for an americano.
   *  - n divisible by 4 and enough courts for everyone (courts >= n/4): n-1 rounds, which is
   *    exactly enough for every player to partner every other player once.
   *  - otherwise: ceil((n-1)*n / (4*C)) where C = min(courts, floor(n/4)). Each round gives 4C
   *    player-slots, so this makes each player play about n-1 matches. Capped at 3n, minimum 3.
   */
  function suggestRounds(n, courts) {
    var C = Math.min(Math.max(1, courts | 0), Math.floor(n / 4));
    if (C < 1) return 3;
    if (n % 4 === 0 && courts >= n / 4) return n - 1;
    return Math.max(3, Math.min(Math.ceil((n - 1) * n / (4 * C)), 3 * n));
  }

  var AM_RUNS = 30;       // whole-schedule restarts
  var AM_ATTEMPTS = 200;  // random partitions tried per round

  /*
   * Builds one americano schedule over player indices 0..n-1.
   * mode 'circle': partnerships come from a circle-method 1-factorisation, so no partnership
   * repeats (only used when all n players play every round and rounds <= n-1). Random work is
   * then only in grouping the pairs into matches to spread opponents.
   * mode 'greedy': per round pick sit-outs, then the best of many random partitions.
   * Returns { rounds: [[ [a1,a2,b1,b2], ... ] ...], cost }.
   */
  function americanoRun(n, C, R, rng, mode) {
    var partner = new Array(n * n), opp = new Array(n * n), sat = new Array(n), lastSat = new Array(n);
    var i, r, total = 0, rounds = [];
    for (i = 0; i < n * n; i++) { partner[i] = 0; opp[i] = 0; }
    for (i = 0; i < n; i++) { sat[i] = 0; lastSat[i] = 0; }

    var circle = null;
    if (mode === 'circle') {
      var arr = shuffled(range(n), rng), all = [];
      for (r = 0; r < n - 1; r++) {
        var ps = [];
        for (i = 0; i < n / 2; i++) ps.push([arr[i], arr[n - 1 - i]]);
        all.push(ps);
        arr.splice(1, 0, arr.pop());
      }
      circle = shuffled(all, rng).slice(0, R);
    }

    // Cost of a candidate list of matches (each [a1,a2,b1,b2]) given history so far.
    // Repeated partners dominate, then repeated opponents.
    function cost(ms) {
      var c = 0;
      for (var k = 0; k < ms.length; k++) {
        var m = ms[k];
        c += 1000 * partner[m[0] * n + m[1]] + 1000 * partner[m[2] * n + m[3]];
        c += 10 * (opp[m[0] * n + m[2]] + opp[m[0] * n + m[3]] + opp[m[1] * n + m[2]] + opp[m[1] * n + m[3]]);
      }
      return c;
    }

    for (r = 0; r < R; r++) {
      var best = null, bestCost = Infinity, a, c2;
      var sitters = [];
      if (circle) {
        for (a = 0; a < AM_ATTEMPTS && bestCost > 0; a++) {
          var order = shuffled(circle[r], rng), cand = [];
          for (i = 0; i < order.length; i += 2) cand.push([order[i][0], order[i][1], order[i + 1][0], order[i + 1][1]]);
          c2 = cost(cand);
          if (c2 < bestCost) { bestCost = c2; best = cand; }
        }
      } else {
        // Sit-outs: fewest so far first, ties random, anyone who sat last round goes to the back of ties.
        var s = n - 4 * C;
        var pick = shuffled(range(n), rng).sort(function (x, y) {
          return (sat[x] - sat[y]) || (lastSat[x] - lastSat[y]);
        });
        sitters = pick.slice(0, s);
        var playing = pick.slice(s);
        for (a = 0; a < AM_ATTEMPTS && bestCost > 0; a++) {
          var p = shuffled(playing, rng), cand2 = [];
          for (i = 0; i < p.length; i += 4) cand2.push([p[i], p[i + 1], p[i + 2], p[i + 3]]);
          c2 = cost(cand2);
          if (c2 < bestCost) { bestCost = c2; best = cand2; }
        }
      }
      total += bestCost;
      for (i = 0; i < n; i++) lastSat[i] = 0;
      sitters.forEach(function (x) { sat[x] += 1; lastSat[x] = 1; });
      best.forEach(function (m) {
        partner[m[0] * n + m[1]]++; partner[m[1] * n + m[0]]++;
        partner[m[2] * n + m[3]]++; partner[m[3] * n + m[2]]++;
        for (var x = 0; x < 2; x++) for (var y = 2; y < 4; y++) {
          opp[m[x] * n + m[y]]++; opp[m[y] * n + m[x]]++;
        }
      });
      rounds.push(best);
    }
    return { rounds: rounds, cost: total };
  }

  function range(n) {
    var a = [];
    for (var i = 0; i < n; i++) a.push(i);
    return a;
  }

  function addAmericanoMatches(data, playerIds, courts, R, rng) {
    var n = playerIds.length;
    var C = Math.min(courts, Math.floor(n / 4));
    var mode = (n % 4 === 0 && C * 4 === n && R <= n - 1) ? 'circle' : 'greedy';
    var best = null;
    for (var i = 0; i < AM_RUNS; i++) {
      var run = americanoRun(n, C, R, rng, mode);
      if (!best || run.cost < best.cost) best = run;
    }
    best.rounds.forEach(function (ms, ri) {
      ms.forEach(function (m, ci) {
        addMatch(data, {
          stage: 'rr', round: ri + 1, court: ci + 1, slot: ci,
          a: [playerIds[m[0]], playerIds[m[1]]], b: [playerIds[m[2]], playerIds[m[3]]]
        });
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Knockout
  // ---------------------------------------------------------------------------

  // Standard recursive seeding order for a bracket of size P: [1, P, ...] such that
  // consecutive pairs are the round-1 matches and seeds 1 and 2 can only meet in the final.
  function seedOrder(P) {
    var order = [1, 2];
    while (order.length < P) {
      var size = order.length * 2, next = [];
      order.forEach(function (s) { next.push(s, size + 1 - s); });
      order = next;
    }
    return order;
  }

  function roundLabel(R, r, P) {
    var fromEnd = R - r;
    if (fromEnd === 0) return 'Final';
    if (fromEnd === 1) return 'Semifinal';
    if (fromEnd === 2) return 'Quarterfinal';
    return 'Round of ' + (P / Math.pow(2, r - 1));
  }

  // entrants: [{ players }] in seed order (seed 1 first). Appends all bracket matches to data.
  function addBracket(data, entrants) {
    var N = entrants.length, P = 1, R = 0;
    while (P < N) { P *= 2; R += 1; }
    var order = seedOrder(P), r, s;
    for (r = 1; r <= R; r++) {
      var count = P / Math.pow(2, r);
      for (s = 0; s < count; s++) {
        var m = { stage: 'ko', round: r, slot: s, a: [], b: [], label: roundLabel(R, r, P) };
        if (r === 1) {
          var ea = entrants[order[2 * s] - 1], eb = entrants[order[2 * s + 1] - 1];
          m.a = ea ? ea.players.slice() : [];
          m.b = eb ? eb.players.slice() : [];
          if (!ea || !eb) m.bye = true;
        }
        addMatch(data, m);
      }
    }
    data.matches.filter(function (m) { return m.stage === 'ko' && m.bye; }).forEach(function (m) {
      propagate(data, m);
    });
  }

  function winnerOf(m) {
    if (m.bye) return m.a.length ? m.a : m.b;
    if (!m.score) return null;
    return m.score[0] > m.score[1] ? m.a : m.b;
  }

  function nextMatch(data, m) {
    for (var i = 0; i < data.matches.length; i++) {
      var x = data.matches[i];
      if (x.stage === 'ko' && x.round === m.round + 1 && x.slot === Math.floor(m.slot / 2)) return x;
    }
    return null;
  }

  // Pushes m's winner (or nothing, if undecided) into the next bracket match. If that changes
  // the entrant already sitting there, the next match's result is wiped and the change cascades.
  function propagate(data, m) {
    var nx = nextMatch(data, m);
    if (!nx) return;
    var side = (m.slot % 2 === 0) ? 'a' : 'b';
    var w = winnerOf(m);
    var next = w ? w.slice() : [];
    if (sideKey(nx[side]) === sideKey(next)) return;
    nx[side] = next;
    if (nx.score !== null) {
      nx.score = null;
      propagate(data, nx);
    }
  }

  // ---------------------------------------------------------------------------
  // generate
  // ---------------------------------------------------------------------------

  function generate(opts) {
    opts = opts || {};
    var mode = opts.mode, format = opts.format;
    var players = (opts.players || []).map(function (p) { return { id: p.id, name: p.name, emoji: p.emoji }; });
    var rng = opts.rng;
    var courts = Math.max(1, Math.floor(Number(opts.courts) || 1));

    if (mode !== 'singles' && mode !== 'doubles') throw new Error('Mode must be singles or doubles');
    var fmt = FORMATS.filter(function (f) { return f.key === format; })[0];
    if (!fmt) throw new Error('Unknown format');
    var seen = {};
    players.forEach(function (p) {
      if (seen[p.id]) throw new Error('Each player can only be added once');
      seen[p.id] = true;
    });

    var data = {
      mode: mode, format: format, players: players, teams: [], courts: courts,
      settings: {}, matches: [], nextId: 1
    };
    var ids = players.map(function (p) { return p.id; });

    if (format === 'americano') {
      if (mode !== 'doubles') throw new Error('Rotating partners is only for doubles');
      if (players.length < 4) throw new Error('Rotating partners needs at least 4 players');
      var R = opts.rounds !== undefined && opts.rounds !== null ? opts.rounds : suggestRounds(players.length, courts);
      if (!isInt(R) || R < 1) throw new Error('Rounds must be a whole number of at least 1');
      data.settings.rounds = R;
      addAmericanoMatches(data, ids, courts, R, rng);
      return data;
    }

    // Entrants for the other formats: players (singles) or teams (doubles).
    var entrants;
    if (mode === 'singles') {
      entrants = players.map(function (p) { return { players: [p.id] }; });
    } else {
      if (opts.teams && opts.teams.length) {
        data.teams = opts.teams.map(function (t) { return { id: t.id, players: t.players.slice() }; });
        data.teams.forEach(function (t) {
          if (t.players.length !== 2 || !seen[t.players[0]] || !seen[t.players[1]]) {
            throw new Error('Every team needs two players from the player list');
          }
        });
      } else {
        data.teams = makeTeams(ids, false, rng);
      }
      entrants = data.teams;
    }
    var E = entrants.length;

    if (format === 'knockout') {
      if (E < 2) throw new Error('Knockout needs at least 2 entrants');
      addBracket(data, entrants);
    } else if (format === 'round_robin') {
      if (E < 2) throw new Error('Round robin needs at least 2 entrants');
      addRoundRobinMatches(data, entrants, courts);
    } else if (format === 'pools_playoff') {
      var size = opts.playoffSize === undefined || opts.playoffSize === null ? 4 : opts.playoffSize;
      if (size !== 2 && size !== 4 && size !== 8) throw new Error('Playoff size must be 2, 4 or 8');
      if (E < 3) throw new Error('Round robin + playoffs needs at least 3 entrants');
      // Playoff size must be smaller than the field: clamp to the largest allowed size that fits.
      while (size >= E) size /= 2;
      data.settings.playoffSize = size;
      addRoundRobinMatches(data, entrants, courts);
    }
    return data;
  }

  // ---------------------------------------------------------------------------
  // Results
  // ---------------------------------------------------------------------------

  function setScore(data, matchId, a, b) {
    var m = findMatch(data, matchId);
    if (!m) throw new Error('Match not found');
    var clearing = (a === null || a === undefined) && (b === null || b === undefined);
    if (m.stage === 'ko') {
      if (m.bye) throw new Error('That match is a bye and is not played');
      if (!m.a.length || !m.b.length) throw new Error('This match is still waiting for its players');
    }
    if (clearing) {
      m.score = null;
    } else {
      if (!isInt(a) || !isInt(b) || a < 0 || b < 0) throw new Error('Scores must be whole numbers, 0 or more');
      if (m.stage === 'ko' && a === b) throw new Error('Knockout matches need a winner');
      m.score = [a, b];
    }
    if (m.stage === 'ko') propagate(data, m);
    return data;
  }

  function rounds(data, stage) {
    stage = stage || 'rr';
    var byRound = {};
    data.matches.forEach(function (m) {
      if (m.stage !== stage) return;
      (byRound[m.round] = byRound[m.round] || []).push(m);
    });
    return Object.keys(byRound).map(Number).sort(function (x, y) { return x - y; }).map(function (r) {
      var ms = byRound[r].slice().sort(function (x, y) { return (x.slot || 0) - (y.slot || 0); });
      var resting = [];
      if (stage === 'rr') {
        var busy = {};
        ms.forEach(function (m) { m.a.concat(m.b).forEach(function (p) { busy[p] = true; }); });
        resting = data.players.map(function (p) { return p.id; }).filter(function (id) { return !busy[id]; });
      }
      return { round: r, matches: ms, resting: resting };
    });
  }

  // ---------------------------------------------------------------------------
  // Standings
  // ---------------------------------------------------------------------------

  function standings(data) {
    var names = {};
    data.players.forEach(function (p) { names[p.id] = p.name || ''; });
    var indiv = data.format === 'americano' || data.mode === 'singles';
    var base = indiv
      ? data.players.map(function (p) { return { key: p.id, players: [p.id] }; })
      : data.teams.map(function (t) { return { key: t.id, players: t.players.slice() }; });
    var rows = base.map(function (e) {
      return {
        key: e.key, players: e.players, played: 0, won: 0, lost: 0, drawn: 0,
        gf: 0, ga: 0, diff: 0, rank: 0,
        _name: e.players.map(function (p) { return names[p] || ''; }).join(' ')
      };
    });
    var bySide = {};
    rows.forEach(function (r) { bySide[sideKey(r.players)] = r; });

    // Which rows does a match side belong to? Americano: each player. Otherwise: the entrant.
    function rowsFor(side) {
      if (data.format === 'americano') return side.map(function (p) { return bySide[p]; });
      return [bySide[sideKey(side)]];
    }
    function credit(side, gf, ga) {
      rowsFor(side).forEach(function (r) {
        if (!r) return;
        r.played += 1; r.gf += gf; r.ga += ga;
        if (gf > ga) r.won += 1; else if (gf < ga) r.lost += 1; else r.drawn += 1;
      });
    }
    data.matches.forEach(function (m) {
      if (m.stage !== 'rr' || !m.score) return;
      credit(m.a, m.score[0], m.score[1]);
      credit(m.b, m.score[1], m.score[0]);
    });
    rows.forEach(function (r) { r.diff = r.gf - r.ga; });

    var keysOf = data.format === 'americano'
      ? function (r) { return [r.gf, r.won, r.diff]; }
      : function (r) { return [r.won, r.diff, r.gf]; };
    function cmpKeys(x, y) {
      var kx = keysOf(x), ky = keysOf(y);
      for (var i = 0; i < kx.length; i++) if (kx[i] !== ky[i]) return ky[i] - kx[i];
      return 0;
    }
    rows.sort(function (x, y) {
      var c = cmpKeys(x, y);
      if (c) return c;
      return x._name < y._name ? -1 : x._name > y._name ? 1 : 0;
    });
    // Competition ranking: ties on all sort keys share a rank (1,1,3).
    rows.forEach(function (r, i) {
      r.rank = (i > 0 && cmpKeys(rows[i - 1], r) === 0) ? rows[i - 1].rank : i + 1;
      delete r._name;
    });
    return rows;
  }

  function finalWinner(data) {
    var final = null;
    data.matches.forEach(function (m) {
      if (m.stage === 'ko' && (!final || m.round > final.round)) final = m;
    });
    if (!final || !final.score) return null;
    var w = winnerOf(final);
    return w && w.length ? w.slice() : null;
  }

  function champion(data) {
    if (data.format === 'knockout' || data.format === 'pools_playoff') return finalWinner(data);
    var rr = data.matches.filter(function (m) { return m.stage === 'rr'; });
    if (!rr.length || rr.some(function (m) { return !m.score; })) return null;
    var out = [];
    standings(data).forEach(function (r) {
      if (r.rank === 1) r.players.forEach(function (p) { if (out.indexOf(p) < 0) out.push(p); });
    });
    return out.length ? out : null;
  }

  function startPlayoffs(data, rng) { // rng unused (seeding is by standings) but kept for API symmetry
    if (data.format !== 'pools_playoff') throw new Error('Playoffs only apply to round robin + playoffs');
    var rr = data.matches.filter(function (m) { return m.stage === 'rr'; });
    if (rr.some(function (m) { return !m.score; })) throw new Error('Finish all round robin matches before starting the playoffs');
    if (data.matches.some(function (m) { return m.stage === 'ko'; })) throw new Error('The playoffs have already started');
    var size = data.settings.playoffSize || 4;
    var rows = standings(data).slice(0, size);
    addBracket(data, rows.map(function (r) { return { players: r.players }; }));
    return data;
  }

  // ---------------------------------------------------------------------------
  // Coverage and progress
  // ---------------------------------------------------------------------------

  function coverage(data) {
    var ids = data.players.map(function (p) { return p.id; });
    var n = ids.length;
    var rr = data.matches.filter(function (m) { return m.stage === 'rr'; });
    var opp = {}, par = {}, played = {}, roundSet = {};
    ids.forEach(function (id) { played[id] = 0; });
    function pk(x, y) { return x < y ? x + '|' + y : y + '|' + x; }

    rr.forEach(function (m) {
      roundSet[m.round] = true;
      m.a.concat(m.b).forEach(function (p) { played[p] = (played[p] || 0) + 1; });
      m.a.forEach(function (x) { m.b.forEach(function (y) { opp[pk(x, y)] = true; }); });
      if (data.format === 'americano') {
        if (m.a.length === 2) par[pk(m.a[0], m.a[1])] = true;
        if (m.b.length === 2) par[pk(m.b[0], m.b[1])] = true;
      }
    });

    var totalPairs = n * (n - 1) / 2;
    // With fixed doubles teams, teammates never face each other, so they are not "possible" opponents.
    var oppTotal = usesFixedTeams(data) ? totalPairs - data.teams.length : totalPairs;
    var nRounds = Object.keys(roundSet).length;
    var counts = ids.map(function (id) { return played[id]; });
    var rests = counts.map(function (c) { return nRounds - c; });
    function minmax(a) { return a.length ? { min: Math.min.apply(null, a), max: Math.max.apply(null, a) } : { min: 0, max: 0 }; }

    return {
      opponents: { covered: Object.keys(opp).length, total: oppTotal },
      partners: data.format === 'americano' ? { covered: Object.keys(par).length, total: totalPairs } : null,
      matchesPerPlayer: minmax(counts),
      restsPerPlayer: minmax(rests)
    };
  }

  function progress(data) {
    var played = 0, total = 0;
    data.matches.forEach(function (m) {
      if (m.bye) return;
      total += 1;
      if (m.score) played += 1;
    });
    return { played: played, total: total };
  }

  var API = {
    FORMATS: FORMATS,
    makeTeams: makeTeams,
    generate: generate,
    suggestRounds: suggestRounds,
    setScore: setScore,
    rounds: rounds,
    standings: standings,
    champion: champion,
    startPlayoffs: startPlayoffs,
    coverage: coverage,
    progress: progress
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.BlitzFormats = API;
})(typeof window !== 'undefined' ? window : globalThis);
