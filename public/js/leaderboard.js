/* Blitz 95 — leaderboard page renderer */
window.Blitz = window.Blitz || { pages: {} };

(function () {
  var B = window.Blitz;

  function medal(rank) {
    if (rank === 1) return '👑';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return rank + '.';
  }

  function trashTalk(players, sessions) {
    var msgs = ['WELCOME TO BLITZ LEADERBOARD 95'];
    var ranked = players.filter(function (p) { return !p.deleted; });
    if (ranked.length) {
      var top = ranked[0];
      msgs.push('👑 REIGNING CHAMPION: ' + top.name.toUpperCase() + ' (' + top.total_points + ' PTS) — BOW OR BE AILED');
      var streaker = ranked.slice().sort(function (a, b) { return b.current_streak - a.current_streak; })[0];
      if (streaker && streaker.current_streak >= 2) {
        msgs.push('🔥 ' + streaker.name.toUpperCase() + ' HAS SHOWED UP ' + streaker.current_streak + ' SESSIONS IN A ROW. TOUCH GRASS (COURT-FLAVORED GRASS ONLY)');
      }
      if (ranked.length >= 3) {
        var last = ranked[ranked.length - 1];
        msgs.push('💀 SOMEBODY PLEASE CHECK ON ' + last.name.toUpperCase());
      }
      var winRates = ranked.filter(function (p) { return p.games_played >= 3; });
      if (winRates.length) {
        var sharp = winRates.slice().sort(function (a, b) { return (b.games_won / b.games_played) - (a.games_won / a.games_played); })[0];
        msgs.push('🎯 ' + sharp.name.toUpperCase() + ' WINS ' + Math.round(100 * sharp.games_won / sharp.games_played) + '% OF GAMES. PROBABLY CHEATING (UNPROVEN)');
      }
    }
    if (sessions.length) {
      msgs.push('📅 LAST SESSION: ' + B.fmtDate(sessions[0].date).toUpperCase() + (sessions[0].title ? ' — "' + sessions[0].title.toUpperCase() + '"' : ''));
    }
    msgs.push('POINTS ARE MADE UP BY THE ADMIN AND THE ADMIN ALONE. NO REFUNDS');
    return msgs;
  }

  function render(root, data) {
    var players = data.players;
    var sessions = data.sessions;
    var esc = B.esc;

    var rows = players.map(function (p, i) {
      var rank = i + 1;
      var cls = [];
      if (!p.deleted) {
        if (rank === 1) cls.push('rank-1');
        if (rank === 2) cls.push('rank-2');
        if (rank === 3) cls.push('rank-3');
        if (rank === players.length && players.length > 3) cls.push('rank-last');
      } else {
        cls.push('player-deleted');
      }
      var streak = p.current_streak >= 2
        ? '<span class="streak-fire">' + p.current_streak + '🔥</span>'
        : (p.current_streak || 0);
      return '<tr class="' + cls.join(' ') + '">' +
        '<td class="rank-cell">' + medal(rank) + '</td>' +
        '<td><div class="player-cell"><span class="player-emoji">' + esc(p.emoji) + '</span>' +
          '<span><span class="player-name">' + esc(p.name) + '</span>' +
          (p.deleted ? ' <small>(retired)</small>' : '') +
          (p.tagline ? '<span class="player-tagline">“' + esc(p.tagline) + '”</span>' : '') +
          '</span></div></td>' +
        '<td class="pts-cell">' + p.total_points + '</td>' +
        '<td class="num-cell">' + p.games_won + '–' + (p.games_played - p.games_won) + '</td>' +
        '<td class="num-cell hide-sm">' + streak + '</td>' +
        '</tr>';
    }).join('');

    var sessionRows = sessions.slice(0, 5).map(function (s) {
      return '<tr class="session-row" data-nav-session="' + s.id + '">' +
        '<td style="white-space:nowrap">📅 ' + B.fmtDate(s.date) + '</td>' +
        '<td>' + esc(s.title || 'untitled shenanigans') + '</td>' +
        '<td class="num-cell">' + s.game_count + ' game' + (s.game_count === 1 ? '' : 's') + '</td>' +
        '</tr>';
    }).join('');

    root.innerHTML =
      '<section class="win95-window">' +
        '<div class="titlebar"><span class="titlebar-text">🏆 HALL_OF_FAME.EXE — official standings</span>' +
          '<span class="titlebar-controls">' +
            '<button data-action="min" aria-label="Minimize">▁</button>' +
            '<button data-action="close" aria-label="Close">✕</button>' +
          '</span></div>' +
        '<div class="win95-body">' +
          (players.length === 0
            ? '<p>No players yet!! The leaderboard hungers. ' +
              'Someone with the sacred admin URL must feed it.</p>'
            : '<div class="w95-table-wrap"><table>' +
              '<thead><tr><th>#</th><th>Player</th><th style="text-align:right">PTS</th><th style="text-align:center">W–L</th><th class="hide-sm" style="text-align:center">Streak</th></tr></thead>' +
              '<tbody>' + rows + '</tbody></table></div>') +
        '</div>' +
        '<div class="statusbar"><span>' + players.filter(function (p) { return !p.deleted; }).length + ' player(s) ranked</span><span>points: whatever admin says</span></div>' +
      '</section>' +

      '<section class="win95-window">' +
        '<div class="titlebar"><span class="titlebar-text">📅 Recent Sessions</span>' +
          '<span class="titlebar-controls">' +
            '<button data-action="min" aria-label="Minimize">▁</button>' +
            '<button data-action="close" aria-label="Close">✕</button>' +
          '</span></div>' +
        '<div class="win95-body">' +
          (sessions.length === 0
            ? '<p>Zero sessions recorded. Allegedly this is a tennis club.</p>'
            : '<div class="w95-table-wrap"><table><tbody>' + sessionRows + '</tbody></table></div>' +
              '<div class="btn-row"><a class="w95-btn" data-nav="sessions" href="sessions.html">Open full session archive ➜</a></div>') +
        '</div>' +
      '</section>';

    B.setTicker(trashTalk(players, sessions));
  }

  B.pages.leaderboard = {
    mount: async function (root) {
      root.innerHTML = '<section class="win95-window"><div class="titlebar"><span class="titlebar-text">🏆 HALL_OF_FAME.EXE</span></div><div class="win95-body"><p class="blink">Loading standings…</p></div></section>';
      try {
        var data = await B.api('/leaderboard');
        render(root, data);
      } catch (e) {
        root.innerHTML = '';
        B.showDialog({ title: 'leaderboard.dll', icon: '❌', body: 'Could not load the leaderboard: <b>' + B.esc(e.message) + '</b><br>Have you tried turning the internet off and on again?' });
      }
    }
  };

  if (!window.BLITZ_PREVIEW) {
    document.addEventListener('DOMContentLoaded', function () {
      var root = document.getElementById('page-leaderboard');
      if (!root) return;
      B.buildChrome('index', { subtitle: 'now with 100% more Comic Sans' });
      B.pages.leaderboard.mount(root);
      root.addEventListener('click', function (e) {
        var row = e.target.closest('[data-nav-session]');
        if (row) location.href = 'sessions.html?id=' + row.dataset.navSession;
      });
    });
  }
})();
