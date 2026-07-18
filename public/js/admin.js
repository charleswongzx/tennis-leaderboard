/* Blitz 95 — BLITZ CONTROL PANEL.EXE (admin) */
window.Blitz = window.Blitz || { pages: {} };

(function () {
  var B = window.Blitz;

  /* mutable page state — refetch & re-render after every write, no cleverness */
  var S = {
    root: null,
    players: [],       // all incl. deleted (?all=1)
    sessions: [],
    editing: null,     // { session, games, points, players } for the open session
    editingGameId: null
  };

  function esc(s) { return B.esc(s); }

  function activePlayers() {
    return S.players.filter(function (p) { return !p.deleted; });
  }

  function playerName(id) {
    var p = S.players.filter(function (x) { return x.id === Number(id); })[0]
      || (S.editing && S.editing.players.filter(function (x) { return x.id === Number(id); })[0]);
    return p ? p.emoji + ' ' + p.name : '❓ #' + id;
  }

  /* every admin write goes through this: shows errors, handles key expiry */
  async function tryWrite(label, fn) {
    try {
      await fn();
      return true;
    } catch (e) {
      if (e.status === 401) {
        B.setAdminKey(null);
        renderGate();
        B.showDialog({ title: 'ACCESS DENIED', icon: '⛔', body: 'The magic word was rejected. The door is closed. The bouncer does not remember you.' });
      } else {
        B.showDialog({ title: label, icon: '❌', body: 'That did not work: <b>' + esc(e.message) + '</b>' });
      }
      return false;
    }
  }

  async function refetchAll() {
    var results = await Promise.all([
      B.api('/players?all=1'),
      B.api('/sessions'),
      S.editing ? B.api('/sessions/' + S.editing.session.id).catch(function () { return null; }) : null
    ]);
    S.players = results[0];
    S.sessions = results[1];
    S.editing = results[2];
    render();
  }

  async function openSession(id) {
    S.editing = await B.api('/sessions/' + id);
    S.editingGameId = null;
    render();
    var ed = document.getElementById('session-editor');
    if (ed) ed.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------- window helper ---------- */

  function win(title, bodyHtml, extra) {
    return '<section class="win95-window" ' + (extra || '') + '>' +
      '<div class="titlebar"><span class="titlebar-text">' + title + '</span>' +
      '<span class="titlebar-controls"><button data-action="min" aria-label="Minimize">▁</button><button data-action="close" aria-label="Close">✕</button></span></div>' +
      '<div class="win95-body">' + bodyHtml + '</div></section>';
  }

  /* ---------- render: key gate ---------- */

  function renderGate() {
    S.root.innerHTML = win('🔐 SPEAK FRIEND AND ENTER',
      '<div class="locked-note">' +
        '<p style="font-size:38px;margin:0">🚪🔒</p>' +
        '<p>This is the <b>BLITZ CONTROL PANEL</b>. It is not for everyone.<br>It is for exactly one (1) admin.</p>' +
        '<label for="gate-key">the magic word</label>' +
        '<input type="password" id="gate-key" placeholder="paste admin key…" style="width:min(280px,90%)">' +
        '<div class="btn-row" style="justify-content:center"><button class="primary" id="gate-go">Enter 🧙</button></div>' +
      '</div>');
    document.getElementById('gate-go').addEventListener('click', function () {
      var v = document.getElementById('gate-key').value.trim();
      if (!v) return;
      B.setAdminKey(v);
      boot();
    });
  }

  /* ---------- render: players window ---------- */

  function playersHtml() {
    var rows = S.players.map(function (p) {
      return '<tr class="' + (p.deleted ? 'player-deleted' : '') + '">' +
        '<td><div class="player-cell"><span class="player-emoji">' + esc(p.emoji) + '</span>' +
          '<span><span class="player-name">' + esc(p.name) + '</span>' +
          (p.tagline ? '<span class="player-tagline">“' + esc(p.tagline) + '”</span>' : '') + '</span></div></td>' +
        '<td class="num-cell" style="white-space:nowrap">' +
          (p.deleted
            ? '<button class="icon-btn" data-act="restore-player" data-id="' + p.id + '" title="restore">♻️</button>'
            : '<button class="icon-btn" data-act="edit-player" data-id="' + p.id + '" title="edit">✏️</button>' +
              '<button class="icon-btn danger" data-act="delete-player" data-id="' + p.id + '" title="retire">🪦</button>') +
        '</td></tr>';
    }).join('');

    return win('👤 PLAYER_ROSTER.EXE',
      (S.players.length ? '<div class="w95-table-wrap"><table><tbody>' + rows + '</tbody></table></div>' : '<p>No players. A leaderboard of ghosts.</p>') +
      '<fieldset><legend id="player-form-legend">Add a new legend</legend>' +
        '<input type="hidden" id="pf-id">' +
        '<div class="form-grid">' +
          '<span><label for="pf-name">name</label><input type="text" id="pf-name" placeholder="e.g. Ballpoint Barry" style="width:100%"></span>' +
          '<span><label for="pf-emoji">emoji</label><input type="text" id="pf-emoji" placeholder="🎾" maxlength="8" style="width:100%"></span>' +
          '<span class="full"><label for="pf-tagline">tagline (their whole personality)</label><input type="text" id="pf-tagline" placeholder="e.g. all forehand, no plan" style="width:100%"></span>' +
        '</div>' +
        '<div class="btn-row">' +
          '<button class="primary" data-act="save-player">💾 Save player</button>' +
          '<button data-act="cancel-player-edit" id="pf-cancel" style="display:none">Cancel edit</button>' +
        '</div>' +
      '</fieldset>');
  }

  /* ---------- render: sessions window ---------- */

  function sessionsHtml() {
    var rows = S.sessions.map(function (s) {
      var isOpen = S.editing && S.editing.session.id === s.id;
      return '<tr' + (isOpen ? ' class="rank-1"' : '') + '>' +
        '<td style="white-space:nowrap">' + B.fmtDate(s.date) + '</td>' +
        '<td><b>' + esc(s.title || 'untitled') + '</b> <small>(' + s.game_count + '🎾 ' + s.player_count + '👤)</small></td>' +
        '<td class="num-cell" style="white-space:nowrap">' +
          '<button class="icon-btn" data-act="open-session" data-id="' + s.id + '" title="edit">' + (isOpen ? '📂' : '📁') + '</button>' +
          '<button class="icon-btn danger" data-act="delete-session" data-id="' + s.id + '" title="delete forever">💥</button>' +
        '</td></tr>';
    }).join('');

    var today = new Date();
    var todayIso = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

    return win('📅 SESSION_MANAGER.EXE',
      (S.sessions.length ? '<div class="w95-table-wrap"><table><tbody>' + rows + '</tbody></table></div>' : '<p>No sessions yet.</p>') +
      '<fieldset><legend>Declare a new session</legend>' +
        '<div class="form-grid">' +
          '<span><label for="sf-date">date</label><input type="date" id="sf-date" value="' + todayIso + '" style="width:100%"></span>' +
          '<span><label for="sf-title">title</label><input type="text" id="sf-title" placeholder="e.g. Sunday Slamdown IV" style="width:100%"></span>' +
          '<span class="full"><label for="sf-notes">notes</label><input type="text" id="sf-notes" placeholder="e.g. Dave brought the bad balls again" style="width:100%"></span>' +
        '</div>' +
        '<div class="btn-row"><button class="primary" data-act="create-session">📅 Create session</button></div>' +
      '</fieldset>');
  }

  /* ---------- render: session editor ---------- */

  function playerOptions(selectedId, allowNone) {
    var opts = allowNone ? '<option value="">— nobody (singles) —</option>' : '<option value="">— pick —</option>';
    var pool = activePlayers().slice();
    /* include retired players already referenced in this session so old games stay editable */
    if (S.editing) {
      S.editing.players.forEach(function (p) {
        if (p.deleted && !pool.some(function (x) { return x.id === p.id; })) pool.push(p);
      });
    }
    pool.forEach(function (p) {
      opts += '<option value="' + p.id + '"' + (Number(selectedId) === p.id ? ' selected' : '') + '>' +
        esc(p.emoji + ' ' + p.name + (p.deleted ? ' (retired)' : '')) + '</option>';
    });
    return opts;
  }

  function editorHtml() {
    if (!S.editing) return '';
    var ed = S.editing;
    var s = ed.session;

    var gameRows = ed.games.map(function (g, i) {
      var sideA = playerName(g.a1) + (g.a2 ? ' & ' + playerName(g.a2) : '');
      var sideB = playerName(g.b1) + (g.b2 ? ' & ' + playerName(g.b2) : '');
      var editing = S.editingGameId === g.id;
      return '<li' + (editing ? ' style="background:#fff6c8"' : '') + '><span class="game-no">#' + (i + 1) + '</span>' +
        (g.winner === 'A' ? '<b>' + sideA + '</b> 🏆 def. ' + sideB : '<b>' + sideB + '</b> 🏆 def. ' + sideA) +
        (g.score_text ? ' — <span class="score-text">' + esc(g.score_text) + '</span>' : '') +
        '<span style="white-space:nowrap;float:right">' +
          '<button class="icon-btn" data-act="move-game" data-id="' + g.id + '" data-dir="-1" title="up" ' + (i === 0 ? 'disabled' : '') + '>🔼</button>' +
          '<button class="icon-btn" data-act="move-game" data-id="' + g.id + '" data-dir="1" title="down" ' + (i === ed.games.length - 1 ? 'disabled' : '') + '>🔽</button>' +
          '<button class="icon-btn" data-act="edit-game" data-id="' + g.id + '" title="edit">✏️</button>' +
          '<button class="icon-btn danger" data-act="delete-game" data-id="' + g.id + '" title="delete">🗑️</button>' +
        '</span></li>';
    }).join('');

    var editingGame = S.editingGameId ? ed.games.filter(function (g) { return g.id === S.editingGameId; })[0] : null;
    var g0 = editingGame || {};

    var pointsMap = {};
    ed.points.forEach(function (r) { pointsMap[r.player_id] = r.points; });
    /* rows: all active players + anyone (even retired) who already has points here */
    var pointPlayers = activePlayers().slice();
    ed.players.forEach(function (p) {
      if (pointsMap[p.id] !== undefined && !pointPlayers.some(function (x) { return x.id === p.id; })) pointPlayers.push(p);
    });
    var pointRows = pointPlayers.map(function (p) {
      var val = pointsMap[p.id] !== undefined ? pointsMap[p.id] : '';
      return '<tr' + (p.deleted ? ' class="player-deleted"' : '') + '><td>' + esc(p.emoji + ' ' + p.name) + (p.deleted ? ' <small>(retired)</small>' : '') + '</td>' +
        '<td class="num-cell"><input type="number" class="pts-input" data-player-id="' + p.id + '" value="' + val + '" placeholder="—"></td></tr>';
    }).join('');

    return win('🔧 EDITING: ' + B.fmtDate(s.date) + ' — ' + esc(s.title || 'untitled'),
      '<fieldset><legend>Session details</legend>' +
        '<div class="form-grid">' +
          '<span><label for="ef-date">date</label><input type="date" id="ef-date" value="' + esc(s.date) + '" style="width:100%"></span>' +
          '<span><label for="ef-title">title</label><input type="text" id="ef-title" value="' + esc(s.title || '') + '" style="width:100%"></span>' +
          '<span class="full"><label for="ef-notes">notes</label><input type="text" id="ef-notes" value="' + esc(s.notes || '') + '" style="width:100%"></span>' +
        '</div>' +
        '<div class="btn-row"><button data-act="save-session-meta">💾 Save details</button>' +
        '<button data-act="close-editor">Close editor</button></div>' +
      '</fieldset>' +

      '<fieldset><legend>🎾 Games (' + ed.games.length + ')</legend>' +
        (ed.games.length ? '<ol class="game-log">' + gameRows + '</ol>' : '<p>No games yet. Surely you played at least one?</p>') +
        '<hr class="w95">' +
        '<b id="game-form-title">' + (editingGame ? '✏️ Editing game' : '➕ Log a game') + '</b>' +
        '<div class="game-form-sides" style="margin-top:8px">' +
          '<div class="side-box sunken"><b>Side A</b>' +
            '<select id="gf-a1">' + playerOptions(g0.a1, false) + '</select>' +
            '<select id="gf-a2">' + playerOptions(g0.a2, true) + '</select></div>' +
          '<div class="vs">⚔️<br>vs</div>' +
          '<div class="side-box sunken"><b>Side B</b>' +
            '<select id="gf-b1">' + playerOptions(g0.b1, false) + '</select>' +
            '<select id="gf-b2">' + playerOptions(g0.b2, true) + '</select></div>' +
        '</div>' +
        '<div class="form-grid" style="margin-top:8px">' +
          '<span><label for="gf-winner">who won??</label><select id="gf-winner" style="width:100%">' +
            '<option value="A"' + (g0.winner !== 'B' ? ' selected' : '') + '>Side A 🏆</option>' +
            '<option value="B"' + (g0.winner === 'B' ? ' selected' : '') + '>Side B 🏆</option></select></span>' +
          '<span><label for="gf-score">score (freeform)</label><input type="text" id="gf-score" value="' + esc(g0.score_text || '') + '" placeholder="6-4, or “they gave up”" style="width:100%"></span>' +
        '</div>' +
        '<div class="btn-row">' +
          '<button class="primary" data-act="save-game">' + (editingGame ? '💾 Update game' : '➕ Add game') + '</button>' +
          (editingGame ? '<button data-act="cancel-game-edit">Cancel</button>' : '') +
        '</div>' +
      '</fieldset>' +

      '<fieldset class="points-sheet"><legend>🧮 Points of the day (admin fiat)</legend>' +
        '<p><small>type points per player, leave blank for “wasn\'t there / gets nothing”. rules are whatever you said they were today.</small></p>' +
        '<div class="w95-table-wrap"><table><tbody>' + pointRows + '</tbody></table></div>' +
        '<div class="btn-row"><button class="primary" data-act="save-points">💾 Decree the points</button></div>' +
      '</fieldset>',
      'id="session-editor"');
  }

  /* ---------- main render ---------- */

  function render() {
    S.root.innerHTML = playersHtml() + sessionsHtml() + editorHtml();
    B.setTicker([
      '🔧 BLITZ CONTROL PANEL — MAXIMUM POWER MODE',
      'WITH GREAT POINTS COMES GREAT FAVORITISM',
      activePlayers().length + ' ACTIVE PLAYERS · ' + S.sessions.length + ' SESSIONS',
      'REMEMBER: YOU CAN JUST MAKE THE NUMBERS UP'
    ]);
  }

  /* ---------- actions ---------- */

  var ACTIONS = {
    'save-player': async function () {
      var id = document.getElementById('pf-id').value;
      var body = {
        name: document.getElementById('pf-name').value.trim(),
        emoji: document.getElementById('pf-emoji').value.trim() || '🎾',
        tagline: document.getElementById('pf-tagline').value.trim() || null
      };
      if (!body.name) return B.showDialog({ title: 'roster.dll', icon: '⚠️', body: 'A player needs a <b>name</b>. Even a bad one.' });
      if (await tryWrite('Save player', function () {
        return id ? B.api('/players/' + id, { method: 'PUT', body: body }) : B.api('/players', { method: 'POST', body: body });
      })) { B.bleep('tada'); await refetchAll(); }
    },
    'edit-player': function (btn) {
      var p = S.players.filter(function (x) { return x.id === Number(btn.dataset.id); })[0];
      if (!p) return;
      document.getElementById('pf-id').value = p.id;
      document.getElementById('pf-name').value = p.name;
      document.getElementById('pf-emoji').value = p.emoji;
      document.getElementById('pf-tagline').value = p.tagline || '';
      document.getElementById('player-form-legend').textContent = 'Editing: ' + p.name;
      document.getElementById('pf-cancel').style.display = '';
      document.getElementById('pf-name').focus();
    },
    'cancel-player-edit': function () { render(); },
    'delete-player': async function (btn) {
      var p = S.players.filter(function (x) { return x.id === Number(btn.dataset.id); })[0];
      if (!(await B.confirm95('Retire <b>' + esc(p.name) + '</b>?<br>Their glorious/embarrassing history stays on the record forever.', { title: 'retirement.exe', icon: '🪦', yes: 'Retire them' }))) return;
      if (await tryWrite('Retire player', function () { return B.api('/players/' + p.id, { method: 'DELETE' }); })) await refetchAll();
    },
    'restore-player': async function (btn) {
      if (await tryWrite('Restore player', function () { return B.api('/players/' + btn.dataset.id, { method: 'PUT', body: { restore: true } }); })) {
        B.bleep('tada'); await refetchAll();
      }
    },

    'create-session': async function () {
      var body = {
        date: document.getElementById('sf-date').value,
        title: document.getElementById('sf-title').value.trim() || null,
        notes: document.getElementById('sf-notes').value.trim() || null
      };
      if (!body.date) return B.showDialog({ title: 'calendar.dll', icon: '⚠️', body: 'Pick a <b>date</b>. Time is real, unfortunately.' });
      var created = null;
      if (await tryWrite('Create session', async function () { created = await B.api('/sessions', { method: 'POST', body: body }); })) {
        S.sessions = await B.api('/sessions');
        await openSession(created.id);
        B.bleep('tada');
      }
    },
    'open-session': async function (btn) { await openSession(Number(btn.dataset.id)); },
    'delete-session': async function (btn) {
      var s = S.sessions.filter(function (x) { return x.id === Number(btn.dataset.id); })[0];
      if (!(await B.confirm95('Delete the session on <b>' + B.fmtDate(s.date) + '</b>?<br>All its games and points go into the shredder. 🚮 <b>This one is actually permanent.</b>', { title: 'shredder.exe', icon: '💥', yes: 'Shred it' }))) return;
      if (await tryWrite('Delete session', function () { return B.api('/sessions/' + s.id, { method: 'DELETE' }); })) {
        if (S.editing && S.editing.session.id === s.id) S.editing = null;
        await refetchAll();
      }
    },
    'close-editor': function () { S.editing = null; S.editingGameId = null; render(); },
    'save-session-meta': async function () {
      var body = {
        date: document.getElementById('ef-date').value,
        title: document.getElementById('ef-title').value.trim() || null,
        notes: document.getElementById('ef-notes').value.trim() || null
      };
      if (await tryWrite('Save session', function () { return B.api('/sessions/' + S.editing.session.id, { method: 'PUT', body: body }); })) {
        B.bleep('tada'); await refetchAll();
      }
    },

    'save-game': async function () {
      var val = function (id) { var v = document.getElementById(id).value; return v ? Number(v) : null; };
      var body = {
        a1: val('gf-a1'), a2: val('gf-a2'), b1: val('gf-b1'), b2: val('gf-b2'),
        winner: document.getElementById('gf-winner').value,
        score_text: document.getElementById('gf-score').value.trim() || null
      };
      if (!body.a1 || !body.b1) return B.showDialog({ title: 'game.dll', icon: '⚠️', body: 'Each side needs at least <b>one</b> player. Tennis against nobody is called practice.' });
      var ids = [body.a1, body.a2, body.b1, body.b2].filter(Boolean);
      if (new Set(ids).size !== ids.length) return B.showDialog({ title: 'game.dll', icon: '⚠️', body: 'The same player cannot be on both sides. We checked the rulebook. Twice.' });
      var ok = await tryWrite('Save game', function () {
        return S.editingGameId
          ? B.api('/games/' + S.editingGameId, { method: 'PUT', body: body })
          : B.api('/sessions/' + S.editing.session.id + '/games', { method: 'POST', body: body });
      });
      if (ok) { S.editingGameId = null; B.bleep('tada'); await refetchAll(); }
    },
    'edit-game': function (btn) {
      S.editingGameId = Number(btn.dataset.id);
      render();
      document.getElementById('game-form-title').scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
    'cancel-game-edit': function () { S.editingGameId = null; render(); },
    'delete-game': async function (btn) {
      if (!(await B.confirm95('Delete this game from the record?', { title: 'revisionism.exe', icon: '🗑️', yes: 'It never happened' }))) return;
      if (await tryWrite('Delete game', function () { return B.api('/games/' + btn.dataset.id, { method: 'DELETE' }); })) await refetchAll();
    },
    'move-game': async function (btn) {
      var id = Number(btn.dataset.id);
      var dir = Number(btn.dataset.dir);
      var games = S.editing.games;
      var idx = games.findIndex(function (g) { return g.id === id; });
      var other = games[idx + dir];
      if (!other) return;
      var g = games[idx];
      /* swap positions; use index-based positions in case of ties */
      var posA = g.position, posB = other.position;
      if (posA === posB) { posA = idx + 1; posB = idx + dir + 1; }
      if (await tryWrite('Reorder games', function () {
        return B.api('/games/' + g.id, { method: 'PUT', body: { position: posB } }).then(function () {
          return B.api('/games/' + other.id, { method: 'PUT', body: { position: posA } });
        });
      })) await refetchAll();
    },

    'save-points': async function () {
      var rows = [];
      var bad = false;
      S.root.querySelectorAll('.pts-input').forEach(function (inp) {
        var v = inp.value.trim();
        if (v === '') return;
        var n = Number(v);
        if (!Number.isInteger(n)) { bad = true; return; }
        rows.push({ player_id: Number(inp.dataset.playerId), points: n });
      });
      if (bad) return B.showDialog({ title: 'math.dll', icon: '⚠️', body: 'Points must be <b>whole numbers</b>. This is a leaderboard, not a physics department.' });
      if (await tryWrite('Save points', function () { return B.api('/sessions/' + S.editing.session.id + '/points', { method: 'PUT', body: { points: rows } }); })) {
        B.bleep('tada');
        await refetchAll();
        B.showDialog({ title: 'decree.exe', icon: '📜', body: 'The points have been <b>decreed</b>. Let the group chat riot commence.', buttons: [{ label: 'So it is written' }] });
      }
    }
  };

  /* ---------- mount ---------- */

  async function boot() {
    if (!B.getAdminKey()) return renderGate();
    S.root.innerHTML = '<section class="win95-window"><div class="titlebar"><span class="titlebar-text">🔧 CONTROL PANEL</span></div><div class="win95-body"><p class="blink">Warming up the admin powers…</p></div></section>';
    try {
      var results = await Promise.all([B.api('/players?all=1'), B.api('/sessions')]);
      S.players = results[0];
      S.sessions = results[1];
      render();
    } catch (e) {
      S.root.innerHTML = '';
      B.showDialog({ title: 'controlpanel.dll', icon: '❌', body: 'Could not load admin data: <b>' + esc(e.message) + '</b>' });
    }
  }

  B.pages.admin = {
    mount: function (root) {
      S.root = root;
      root.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-act]');
        if (btn && ACTIONS[btn.dataset.act]) ACTIONS[btn.dataset.act](btn);
      });
      boot();
    }
  };

  if (!window.BLITZ_PREVIEW) {
    document.addEventListener('DOMContentLoaded', function () {
      var root = document.getElementById('page-admin');
      if (!root) return;
      B.captureAdminKeyFromUrl();
      B.buildChrome('admin', { subtitle: 'MAXIMUM POWER MODE', showAdminTab: true });
      B.pages.admin.mount(root);
    });
  }
})();
