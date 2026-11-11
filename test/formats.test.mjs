import assert from 'node:assert';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const F = require('../public/js/formats.js');

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const mkPlayers = (n) => Array.from({ length: n }, (_, i) => ({ id: 'p' + (i + 1), name: 'Player ' + (i + 1), emoji: '🎾' }));
const pairKey = (x, y) => (x < y ? x + '|' + y : y + '|' + x);

let failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok   - ' + name); }
  catch (e) { failed++; console.log('FAIL - ' + name + '\n' + (e && e.stack || e)); }
}

function checkNoDoubleBooking(d) {
  for (const r of F.rounds(d, 'rr')) {
    const seen = new Set();
    for (const m of r.matches) for (const p of m.a.concat(m.b)) {
      assert.ok(!seen.has(p), 'player ' + p + ' twice in round ' + r.round);
      seen.add(p);
    }
  }
}
function partnerRepeats(d) {
  const seen = new Set(); let rep = 0;
  for (const m of d.matches) for (const s of [m.a, m.b]) {
    const k = pairKey(s[0], s[1]);
    if (seen.has(k)) rep++; seen.add(k);
  }
  return rep;
}
// score every rr match so lower-numbered player/side wins
function scoreAll(d) {
  for (const m of d.matches) if (m.stage === 'rr' && !m.score) {
    const num = (s) => Math.min(...s.map((p) => parseInt(p.slice(1))));
    if (num(m.a) < num(m.b)) F.setScore(d, m.id, 6, 2); else F.setScore(d, m.id, 2, 6);
  }
}

for (const n of [4, 5, 6, 7]) {
  test('round robin singles n=' + n, () => {
    const d = F.generate({ mode: 'singles', format: 'round_robin', players: mkPlayers(n), courts: 8, rng: mulberry32(n) });
    const seen = new Set();
    d.matches.forEach((m) => { const k = pairKey(m.a[0], m.b[0]); assert.ok(!seen.has(k)); seen.add(k); });
    assert.strictEqual(seen.size, n * (n - 1) / 2);
    checkNoDoubleBooking(d);
    const rs = F.rounds(d);
    const rests = {};
    rs.forEach((r) => r.resting.forEach((p) => { rests[p] = (rests[p] || 0) + 1; }));
    if (n % 2) { assert.strictEqual(rs.length, n); d.players.forEach((p) => assert.strictEqual(rests[p.id], 1)); }
    else { assert.strictEqual(rs.length, n - 1); assert.deepStrictEqual(rests, {}); }
    const d1 = F.generate({ mode: 'singles', format: 'round_robin', players: mkPlayers(n), courts: 1 });
    F.rounds(d1).forEach((r) => assert.strictEqual(r.matches.length, 1));
    assert.strictEqual(d1.matches.length, n * (n - 1) / 2);
    assert.strictEqual(d1.nextId, d1.matches.length + 1);
  });
}

test('round robin doubles 6 players -> 3 teams, 3 matches', () => {
  const d = F.generate({ mode: 'doubles', format: 'round_robin', players: mkPlayers(6), courts: 2 });
  assert.strictEqual(d.teams.length, 3);
  assert.strictEqual(d.matches.length, 3);
  assert.deepStrictEqual(d.teams[0], { id: 't1', players: ['p1', 'p2'] });
  const c = F.coverage(d);
  assert.deepStrictEqual(c.opponents, { covered: 12, total: 12 });
  assert.strictEqual(c.partners, null);
});

test('americano n=4, 3 rounds, 1 court', () => {
  const d = F.generate({ mode: 'doubles', format: 'americano', players: mkPlayers(4), courts: 1, rounds: 3, rng: mulberry32(1) });
  assert.strictEqual(d.matches.length, 3);
  assert.strictEqual(partnerRepeats(d), 0);
  checkNoDoubleBooking(d);
  const c = F.coverage(d);
  assert.deepStrictEqual(c.matchesPerPlayer, { min: 3, max: 3 });
  assert.deepStrictEqual(c.partners, { covered: 6, total: 6 });
});

test('americano n=8, 7 rounds, 2 courts (several seeds)', () => {
  for (let s = 1; s <= 10; s++) {
    const d = F.generate({ mode: 'doubles', format: 'americano', players: mkPlayers(8), courts: 2, rounds: 7, rng: mulberry32(s) });
    assert.strictEqual(d.matches.length, 14);
    assert.strictEqual(partnerRepeats(d), 0);
    checkNoDoubleBooking(d);
    assert.deepStrictEqual(F.coverage(d).matchesPerPlayer, { min: 7, max: 7 });
  }
});

test('americano default rounds follow suggestRounds', () => {
  assert.strictEqual(F.suggestRounds(8, 2), 7);
  assert.strictEqual(F.suggestRounds(8, 1), 14);
  assert.strictEqual(F.suggestRounds(4, 3), 3);
  assert.ok(F.suggestRounds(9, 2) >= 3);
  const d = F.generate({ mode: 'doubles', format: 'americano', players: mkPlayers(9), courts: 2 });
  assert.strictEqual(d.settings.rounds, F.suggestRounds(9, 2));
});

test('americano n=9, 2 courts: sit-outs balanced, none twice in a row', () => {
  for (let s = 1; s <= 5; s++) {
    const d = F.generate({ mode: 'doubles', format: 'americano', players: mkPlayers(9), courts: 2, rounds: 9, rng: mulberry32(s) });
    checkNoDoubleBooking(d);
    const rs = F.rounds(d);
    const sits = {}; let prev = [];
    rs.forEach((r) => {
      assert.strictEqual(r.resting.length, 1);
      r.resting.forEach((p) => { sits[p] = (sits[p] || 0) + 1; assert.ok(!prev.includes(p), 'sat twice in a row'); });
      prev = r.resting;
    });
    const vals = d.players.map((p) => sits[p.id] || 0);
    assert.ok(Math.max(...vals) - Math.min(...vals) <= 1);
    const c = F.coverage(d);
    assert.ok(c.matchesPerPlayer.max - c.matchesPerPlayer.min <= 1);
  }
});

test('americano timing n=16, courts=4, 15 rounds', () => {
  const t = Date.now();
  const d = F.generate({ mode: 'doubles', format: 'americano', players: mkPlayers(16), courts: 4, rounds: 15, rng: mulberry32(7) });
  const ms = Date.now() - t;
  console.log('       (took ' + ms + 'ms)');
  assert.ok(ms < 500, 'too slow: ' + ms);
  assert.strictEqual(d.matches.length, 60);
  assert.strictEqual(partnerRepeats(d), 0);
  checkNoDoubleBooking(d);
});

test('americano timing odd n=15, courts=3, 15 rounds', () => {
  const t = Date.now();
  const d = F.generate({ mode: 'doubles', format: 'americano', players: mkPlayers(15), courts: 3, rounds: 15, rng: mulberry32(7) });
  assert.ok(Date.now() - t < 500);
  checkNoDoubleBooking(d);
});

const ko = (n, mode) => F.generate({ mode: mode || 'singles', format: 'knockout', players: mkPlayers(n), rng: mulberry32(3) });
const koMatch = (d, r, s) => d.matches.find((m) => m.stage === 'ko' && m.round === r && m.slot === s);

test('knockout n=2', () => {
  const d = ko(2);
  assert.strictEqual(d.matches.length, 1);
  assert.strictEqual(d.matches[0].label, 'Final');
  F.setScore(d, 'm1', 6, 3);
  assert.deepStrictEqual(F.champion(d), ['p1']);
});

test('knockout n=3 byes', () => {
  const d = ko(3);
  assert.strictEqual(d.matches.length, 3);
  const m = koMatch(d, 1, 0);
  assert.ok(m.bye); assert.deepStrictEqual(m.a, ['p1']); assert.deepStrictEqual(m.b, []);
  assert.deepStrictEqual(koMatch(d, 2, 0).a, ['p1']);
  assert.deepStrictEqual(koMatch(d, 1, 1).a, ['p2']);
  assert.throws(() => F.setScore(d, m.id, 1, 0), /bye/);
  assert.throws(() => F.setScore(d, koMatch(d, 2, 0).id, 1, 0), /waiting/);
  assert.deepStrictEqual(F.progress(d), { played: 0, total: 2 });
  F.setScore(d, koMatch(d, 1, 1).id, 6, 4);
  assert.deepStrictEqual(koMatch(d, 2, 0).b, ['p2']);
  F.setScore(d, koMatch(d, 2, 0).id, 3, 6);
  assert.deepStrictEqual(F.champion(d), ['p2']);
});

test('knockout n=5 structure and labels', () => {
  const d = ko(5);
  assert.strictEqual(d.matches.length, 7);
  assert.strictEqual(d.matches.filter((m) => m.bye).length, 3);
  assert.strictEqual(koMatch(d, 1, 0).label, 'Quarterfinal');
  assert.strictEqual(koMatch(d, 2, 0).label, 'Semifinal');
  assert.strictEqual(koMatch(d, 3, 0).label, 'Final');
  // seed 1 v bye, 4 v 5 real match
  assert.deepStrictEqual(koMatch(d, 1, 1).a, ['p4']); assert.deepStrictEqual(koMatch(d, 1, 1).b, ['p5']);
  assert.deepStrictEqual(koMatch(d, 2, 0).a, ['p1']);
  assert.deepStrictEqual(koMatch(d, 2, 1).a, ['p2']);
  assert.deepStrictEqual(koMatch(d, 2, 1).b, ['p3']);
  assert.deepStrictEqual(F.progress(d), { played: 0, total: 4 });
});

test('knockout n=8, propagation, editing clears downstream, ties throw', () => {
  const d = ko(8);
  assert.strictEqual(d.matches.length, 7);
  assert.strictEqual(d.nextId, 8);
  assert.strictEqual(koMatch(d, 1, 0).label, 'Quarterfinal');
  assert.deepStrictEqual([koMatch(d, 1, 0).a[0], koMatch(d, 1, 0).b[0]], ['p1', 'p8']);
  assert.deepStrictEqual([koMatch(d, 1, 1).a[0], koMatch(d, 1, 1).b[0]], ['p4', 'p5']);
  assert.deepStrictEqual([koMatch(d, 1, 2).a[0], koMatch(d, 1, 2).b[0]], ['p2', 'p7']);
  assert.deepStrictEqual([koMatch(d, 1, 3).a[0], koMatch(d, 1, 3).b[0]], ['p3', 'p6']);
  assert.throws(() => F.setScore(d, koMatch(d, 1, 0).id, 6, 6), /Knockout matches need a winner/);
  // higher seed wins all quarters
  for (let s = 0; s < 4; s++) F.setScore(d, koMatch(d, 1, s).id, 6, 1);
  assert.deepStrictEqual([koMatch(d, 2, 0).a[0], koMatch(d, 2, 0).b[0]], ['p1', 'p4']);
  assert.deepStrictEqual([koMatch(d, 2, 1).a[0], koMatch(d, 2, 1).b[0]], ['p2', 'p3']);
  F.setScore(d, koMatch(d, 2, 0).id, 6, 3);
  F.setScore(d, koMatch(d, 2, 1).id, 6, 3);
  F.setScore(d, koMatch(d, 3, 0).id, 7, 5);
  assert.deepStrictEqual(F.champion(d), ['p1']);
  // flip semifinal 1 result: p4 now advances, final must be cleared
  F.setScore(d, koMatch(d, 2, 0).id, 3, 6);
  const fin = koMatch(d, 3, 0);
  assert.strictEqual(fin.score, null);
  assert.deepStrictEqual(fin.a, ['p4']);
  assert.strictEqual(F.champion(d), null);
  // same winner, new margin: leaves final alone
  F.setScore(d, fin.id, 6, 0);
  F.setScore(d, koMatch(d, 2, 0).id, 2, 6);
  assert.deepStrictEqual(fin.score, [6, 0]);
  // flipping a quarter cascades through semi and final
  F.setScore(d, koMatch(d, 1, 0).id, 1, 6);
  assert.strictEqual(koMatch(d, 2, 0).score, null);
  assert.strictEqual(fin.score, null);
  assert.deepStrictEqual(fin.a, []);
  // clearing a quarter removes the entrant downstream
  F.setScore(d, koMatch(d, 1, 0).id, null, null);
  assert.deepStrictEqual(koMatch(d, 2, 0).a, []);
});

test('knockout doubles uses teams as entrants', () => {
  const d = ko(8, 'doubles');
  assert.strictEqual(d.teams.length, 4);
  assert.strictEqual(d.matches.length, 3);
  assert.deepStrictEqual(koMatch(d, 1, 0).a, ['p1', 'p2']);
  F.setScore(d, koMatch(d, 1, 0).id, 6, 0);
  assert.deepStrictEqual(koMatch(d, 2, 0).a, ['p1', 'p2']);
});

test('pools_playoff n=6 playoffSize 4', () => {
  const d = F.generate({ mode: 'singles', format: 'pools_playoff', players: mkPlayers(6), courts: 3, playoffSize: 4, rng: mulberry32(2) });
  assert.strictEqual(d.matches.length, 15);
  assert.strictEqual(d.settings.playoffSize, 4);
  assert.throws(() => F.startPlayoffs(d), /Finish all/);
  assert.strictEqual(F.champion(d), null);
  scoreAll(d);
  assert.deepStrictEqual(F.progress(d), { played: 15, total: 15 });
  F.startPlayoffs(d);
  assert.throws(() => F.startPlayoffs(d), /already started/);
  const ids = d.matches.map((m) => m.id);
  assert.strictEqual(new Set(ids).size, ids.length);
  assert.deepStrictEqual([koMatch(d, 1, 0).a[0], koMatch(d, 1, 0).b[0]], ['p1', 'p4']);
  assert.deepStrictEqual([koMatch(d, 1, 1).a[0], koMatch(d, 1, 1).b[0]], ['p2', 'p3']);
  assert.strictEqual(koMatch(d, 1, 0).label, 'Semifinal');
  assert.strictEqual(F.champion(d), null);
  F.setScore(d, koMatch(d, 1, 0).id, 6, 2);
  F.setScore(d, koMatch(d, 1, 1).id, 3, 6);
  F.setScore(d, koMatch(d, 2, 0).id, 4, 6);
  assert.deepStrictEqual(F.champion(d), ['p3']);
  assert.deepStrictEqual(F.progress(d), { played: 18, total: 18 });
});

test('pools_playoff clamps playoff size to the field', () => {
  const d = F.generate({ mode: 'singles', format: 'pools_playoff', players: mkPlayers(4), playoffSize: 8 });
  assert.strictEqual(d.settings.playoffSize, 2);
  const d2 = F.generate({ mode: 'singles', format: 'pools_playoff', players: mkPlayers(5), playoffSize: 8 });
  assert.strictEqual(d2.settings.playoffSize, 4);
  assert.throws(() => F.generate({ mode: 'singles', format: 'pools_playoff', players: mkPlayers(6), playoffSize: 3 }), /2, 4 or 8/);
});

test('standings: ties share a rank (1,1,3)', () => {
  const d = F.generate({ mode: 'singles', format: 'round_robin', players: mkPlayers(3), courts: 1 });
  const get = (a, b) => d.matches.find((m) => pairKey(m.a[0], m.b[0]) === pairKey(a, b));
  const sc = (a, b, x, y) => { const m = get(a, b); F.setScore(d, m.id, m.a[0] === a ? x : y, m.a[0] === a ? y : x); };
  sc('p1', 'p3', 6, 0); sc('p2', 'p3', 6, 0); sc('p1', 'p2', 3, 3);
  const st = F.standings(d);
  assert.deepStrictEqual(st.map((r) => r.rank), [1, 1, 3]);
  assert.deepStrictEqual(st.map((r) => r.key), ['p1', 'p2', 'p3']);
  assert.strictEqual(st[0].drawn, 1); assert.strictEqual(st[0].gf, 9); assert.strictEqual(st[0].diff, 6);
  assert.deepStrictEqual(F.champion(d), ['p1', 'p2']);
});

test('standings: unscored entrants included with zero played', () => {
  const d = F.generate({ mode: 'singles', format: 'round_robin', players: mkPlayers(4), courts: 2 });
  const st = F.standings(d);
  assert.strictEqual(st.length, 4);
  st.forEach((r) => { assert.strictEqual(r.played, 0); assert.strictEqual(r.rank, 1); });
});

test('standings: americano sorts by games won (gf)', () => {
  const d = F.generate({ mode: 'doubles', format: 'americano', players: mkPlayers(4), courts: 1, rng: mulberry32(1) });
  const r1 = d.matches[0];
  F.setScore(d, r1.id, 4, 6);
  const st = F.standings(d);
  assert.strictEqual(st.length, 4);
  assert.deepStrictEqual(new Set(st.slice(0, 2).map((r) => r.key)), new Set(r1.b));
  assert.strictEqual(st[0].gf, 6); assert.strictEqual(st[0].won, 1);
  assert.strictEqual(st[3].gf, 4); assert.strictEqual(st[3].lost, 1);
  assert.deepStrictEqual(st.map((r) => r.rank), [1, 1, 3, 3]);
  assert.strictEqual(F.champion(d), null);
  d.matches.slice(1).forEach((m) => F.setScore(d, m.id, 6, 0));
  assert.ok(Array.isArray(F.champion(d)));
});

test('standings: doubles round robin rows are teams', () => {
  const d = F.generate({ mode: 'doubles', format: 'round_robin', players: mkPlayers(8), courts: 2 });
  F.setScore(d, d.matches[0].id, 6, 4);
  const st = F.standings(d);
  assert.strictEqual(st.length, 4);
  assert.ok(/^t\d$/.test(st[0].key));
  assert.strictEqual(st[0].players.length, 2);
});

test('generate throws friendly errors', () => {
  assert.throws(() => F.generate({ mode: 'doubles', format: 'americano', players: mkPlayers(3) }), /Rotating partners needs at least 4 players/);
  assert.throws(() => F.generate({ mode: 'singles', format: 'americano', players: mkPlayers(6) }), /only for doubles/);
  assert.throws(() => F.generate({ mode: 'doubles', format: 'round_robin', players: mkPlayers(5) }), /even number of players/);
  assert.throws(() => F.generate({ mode: 'singles', format: 'knockout', players: mkPlayers(1) }), /Knockout needs at least 2 entrants/);
  assert.throws(() => F.makeTeams(['a', 'b', 'c']), /even number/);
});

test('makeTeams order and shuffle', () => {
  assert.deepStrictEqual(F.makeTeams(['a', 'b', 'c', 'd']), [{ id: 't1', players: ['a', 'b'] }, { id: 't2', players: ['c', 'd'] }]);
  const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
  const t = F.makeTeams(ids, true, mulberry32(5));
  assert.deepStrictEqual(t.flatMap((x) => x.players).sort(), ids);
  assert.deepStrictEqual(F.makeTeams(ids, true, mulberry32(5)), t);
});

test('coverage round robin singles n=5', () => {
  const d = F.generate({ mode: 'singles', format: 'round_robin', players: mkPlayers(5), courts: 2 });
  const c = F.coverage(d);
  assert.deepStrictEqual(c.opponents, { covered: 10, total: 10 });
  assert.strictEqual(c.partners, null);
  assert.deepStrictEqual(c.matchesPerPlayer, { min: 4, max: 4 });
  assert.deepStrictEqual(c.restsPerPlayer, { min: d.matches.length ? F.rounds(d).length - 4 : 0, max: F.rounds(d).length - 4 });
});

test('JSON round trip keeps working', () => {
  let d = F.generate({ mode: 'singles', format: 'pools_playoff', players: mkPlayers(5), courts: 2, playoffSize: 2, rng: mulberry32(9) });
  d = JSON.parse(JSON.stringify(d));
  scoreAll(d);
  d = JSON.parse(JSON.stringify(d));
  F.startPlayoffs(d);
  d = JSON.parse(JSON.stringify(d));
  const fin = d.matches.find((m) => m.label === 'Final');
  F.setScore(d, fin.id, 6, 1);
  assert.deepStrictEqual(F.champion(d), ['p1']);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(d)), d);
});

test('FORMATS metadata', () => {
  assert.deepStrictEqual(F.FORMATS.map((f) => f.key), ['round_robin', 'americano', 'knockout', 'pools_playoff']);
  F.FORMATS.forEach((f) => { assert.ok(f.label && f.blurb && f.modes.length && f.minPlayers); });
  assert.deepStrictEqual(F.FORMATS[1].modes, ['doubles']);
});

if (failed) { console.log('\n' + failed + ' test(s) failed'); process.exit(1); }
console.log('\nall tests passed');
