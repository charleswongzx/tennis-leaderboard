/* Blitz 95 — sessions page renderer (list + detail) */
window.Blitz = window.Blitz || { pages: {} };

(function () {
  var B = window.Blitz;

  function playerLabel(map, id) {
    var p = map[id];
    if (!p) return '❓ mystery player #' + id;
    return B.esc(p.emoji) + ' ' + B.esc(p.name);
  }

  function sideLabel(map, p1, p2) {
    var s = playerLabel(map, p1);
    if (p2) s += ' &amp; ' + playerLabel(map, p2);
    return s;
  }

  function renderList(root, sessions) {
    var esc = B.esc;
    var rows = sessions.map(function (s) {
      return '<tr class="session-row" data-session-id="' + s.id + '">' +
        '<td style="white-space:nowrap">📅 ' + B.fmtDate(s.date) + '</td>' +
        '<td><b>' + esc(s.title || 'untitled shenanigans') + '</b>' +
          (s.notes ? '<span class="player-tagline">' + esc(s.notes) + '</span>' : '') + '</td>' +
        '<td class="num-cell">' + s.game_count + '🎾</td>' +
        '<td class="num-cell hide-sm">' + s.player_count + '👤</td>' +
        '</tr>';
    }).join('');

    root.innerHTML =
      '<section class="win95-window">' +
        '<div class="titlebar"><span class="titlebar-text">📅 SESSION_ARCHIVE.EXE — every fateful day</span>' +
          '<span class="titlebar-controls"><button data-action="min" aria-label="Minimize">▁</button><button data-action="close" aria-label="Close">✕</button></span></div>' +
        '<div class="win95-body">' +
          (sessions.length === 0
            ? '<p>No sessions yet. The courts remain unconquered.</p>'
            : '<div class="w95-table-wrap"><table>' +
              '<thead><tr><th>Date</th><th>Session</th><th>Games</th><th class="hide-sm">Players</th></tr></thead>' +
              '<tbody>' + rows + '</tbody></table></div>' +
              '<p><small>tap a session to relive the trauma</small></p>') +
        '</div>' +
        '<div class="statusbar"><span>' + sessions.length + ' session(s) on record</span></div>' +
      '</section>';

    B.setTicker(['📅 THE ARCHIVE REMEMBERS EVERYTHING', 'EVERY SHANK. EVERY DOUBLE FAULT. FOREVER.', sessions.length + ' SESSIONS OF DOCUMENTED CHAOS']);
  }

  function renderDetail(root, data) {
    var esc = B.esc;
    var s = data.session;
    var playerMap = {};
    data.players.forEach(function (p) { playerMap[p.id] = p; });

    var gameItems = data.games.map(function (g, i) {
      var winnerSide = g.winner === 'A' ? sideLabel(playerMap, g.a1, g.a2) : sideLabel(playerMap, g.b1, g.b2);
      var loserSide  = g.winner === 'A' ? sideLabel(playerMap, g.b1, g.b2) : sideLabel(playerMap, g.a1, g.a2);
      return '<li><span class="game-no">#' + (i + 1) + '</span>' +
        '<span class="winner-side">' + winnerSide + '</span> 🏆 def. ' + loserSide +
        (g.score_text ? ' — <span class="score-text">' + esc(g.score_text) + '</span>' : '') +
        '</li>';
    }).join('');

    var pointRows = data.points
      .slice()
      .sort(function (a, b) { return b.points - a.points; })
      .map(function (row, i) {
        return '<tr' + (i === 0 ? ' class="rank-1"' : '') + '>' +
          '<td>' + playerLabel(playerMap, row.player_id) +
            (playerMap[row.player_id] && playerMap[row.player_id].deleted ? ' <small>(retired)</small>' : '') + '</td>' +
          '<td class="pts-cell">' + (i === 0 ? '👑 ' : '') + row.points + '</td></tr>';
      }).join('');

    root.innerHTML =
      '<section class="win95-window">' +
        '<div class="titlebar"><span class="titlebar-text">📅 ' + B.fmtDate(s.date) + ' — ' + esc(s.title || 'untitled shenanigans') + '</span>' +
          '<span class="titlebar-controls"><button data-action="min" aria-label="Minimize">▁</button><button data-action="close" aria-label="Close">✕</button></span></div>' +
        '<div class="win95-body">' +
          (s.notes ? '<p class="notes-box">📝 ' + esc(s.notes) + '</p>' : '') +
          '<div class="btn-row"><a class="w95-btn" data-nav="sessions" href="sessions.html">⬅ back to archive</a></div>' +
        '</div>' +
      '</section>' +

      '<section class="win95-window">' +
        '<div class="titlebar"><span class="titlebar-text">🎾 game_log.txt</span>' +
          '<span class="titlebar-controls"><button data-action="min" aria-label="Minimize">▁</button><button data-action="close" aria-label="Close">✕</button></span></div>' +
        '<div class="win95-body">' +
          (data.games.length === 0
            ? '<p>No games logged. Did you just… hang out?</p>'
            : '<ol class="game-log">' + gameItems + '</ol>') +
        '</div>' +
      '</section>' +

      '<section class="win95-window">' +
        '<div class="titlebar"><span class="titlebar-text">🧮 points_of_the_day.xls</span>' +
          '<span class="titlebar-controls"><button data-action="min" aria-label="Minimize">▁</button><button data-action="close" aria-label="Close">✕</button></span></div>' +
        '<div class="win95-body">' +
          (data.points.length === 0
            ? '<p>The admin has not yet decreed the points. The council deliberates.</p>'
            : '<div class="w95-table-wrap"><table>' +
              '<thead><tr><th>Player</th><th style="text-align:right">Points awarded</th></tr></thead>' +
              '<tbody>' + pointRows + '</tbody></table></div>' +
              '<p><small>point values were decided by completely fair and unbiased admin fiat</small></p>') +
        '</div>' +
      '</section>';

    B.setTicker(['📼 NOW REPLAYING: ' + (s.title || 'SESSION #' + s.id).toUpperCase(), data.games.length + ' GAMES OF PURE CINEMA', 'NO VAR. NO APPEALS. NO MERCY.']);
  }

  B.pages.sessions = {
    mount: async function (root, params) {
      params = params || {};
      root.innerHTML = '<section class="win95-window"><div class="titlebar"><span class="titlebar-text">📅 SESSION_ARCHIVE.EXE</span></div><div class="win95-body"><p class="blink">Rewinding the tapes…</p></div></section>';
      try {
        if (params.sessionId) {
          renderDetail(root, await B.api('/sessions/' + params.sessionId));
        } else {
          renderList(root, await B.api('/sessions'));
        }
      } catch (e) {
        root.innerHTML = '';
        B.showDialog({ title: 'sessions.dll', icon: '❌', body: 'Could not load sessions: <b>' + B.esc(e.message) + '</b>' });
      }
    }
  };

  if (!window.BLITZ_PREVIEW) {
    document.addEventListener('DOMContentLoaded', function () {
      var root = document.getElementById('page-sessions');
      if (!root) return;
      B.buildChrome('sessions', { subtitle: 'the permanent record' });
      var id = new URLSearchParams(location.search).get('id');
      B.pages.sessions.mount(root, { sessionId: id ? Number(id) : null });
      root.addEventListener('click', function (e) {
        var row = e.target.closest('[data-session-id]');
        if (row) location.href = 'sessions.html?id=' + row.dataset.sessionId;
      });
    });
  }
})();
