/* Weembledon '95 - Tournaments.
   /tournament.html?new=1  builder: names in, pick singles/doubles and a format, preview, start
   /tournament.html?id=N   viewer: order of play, standings, draw; umpires enter results */
window.Blitz = window.Blitz || { pages: {} };

(function () {
  var B = window.Blitz;
  var F = window.BlitzFormats;
  var esc = B.esc;

  /* ---------- shared helpers ---------- */

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rng) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function formatMeta(key) { return F.FORMATS.filter(function (f) { return f.key === key; })[0] || { label: key }; }

  function playerMap(data) {
    var m = {};
    (data.players || []).forEach(function (p) { m[p.id] = p; });
    return m;
  }

  function sideHtml(data, ids, pm) {
    if (!ids || !ids.length) return '<span class="tbd">TBD</span>';
    pm = pm || playerMap(data);
    return ids.map(function (id) {
      var p = pm[id];
      return p ? esc(p.emoji) + ' ' + esc(p.name) : '???';
    }).join(' &amp; ');
  }

  function sideText(data, ids) {
    var pm = playerMap(data);
    return (ids || []).map(function (id) { return pm[id] ? pm[id].emoji + ' ' + pm[id].name : '???'; }).join(' & ');
  }

  function pct(c) { return c.total ? Math.round(100 * c.covered / c.total) : 100; }

  function coverageHtml(data) {
    var c = F.coverage(data);
    function meter(label, val, note) {
      return '<div class="meter-row"><span>' + label + '</span><div class="meter"><i style="width:' + val + '%"></i></div><b>' + note + '</b></div>';
    }
    var html = meter('Faces everyone', pct(c.opponents), c.opponents.covered + '/' + c.opponents.total + ' pairs');
    if (c.partners) html += meter('Partners everyone', pct(c.partners), c.partners.covered + '/' + c.partners.total + ' pairs');
    html += '<p class="small muted" style="margin:6px 0 0">Matches per player: <b>' + c.matchesPerPlayer.min +
      (c.matchesPerPlayer.max !== c.matchesPerPlayer.min ? '-' + c.matchesPerPlayer.max : '') + '</b>' +
      (c.restsPerPlayer.max ? ' · sits out: <b>' + c.restsPerPlayer.min + (c.restsPerPlayer.max !== c.restsPerPlayer.min ? '-' + c.restsPerPlayer.max : '') + '</b> round(s)' : '') +
      '</p>';
    return html;
  }

  /* =====================================================================
     BUILDER
     ===================================================================== */

  var NB = {
    title: '',
    date: B.today(),
    names: '',
    mode: 'singles',
    format: 'round_robin',
    teams: 'random',     // doubles team formats: 'random' | 'listed'
    seeding: 'random',   // knockout: 'random' | 'listed'
    courts: 2,
    rounds: '',          // americano: '' = suggested
    playoffSize: 4,
    seed: Math.floor(Math.random() * 1e9),
    preview: null,
    error: null
  };

  function parseNames(text) {
    var seen = {};
    return text.split(/[\n,]+/).map(function (s) { return s.replace(/\s+/g, ' ').trim().slice(0, 28); })
      .filter(function (s) {
        var k = s.toLowerCase();
        if (!s || seen[k]) return false;
        seen[k] = true;
        return true;
      });
  }

  function buildData() {
    var names = parseNames(NB.names);
    var rng = mulberry32(NB.seed);
    var offset = Math.floor(rng() * B.EMOJIS.length);
    var players = names.map(function (n, i) { return { id: 'p' + (i + 1), name: n, emoji: B.EMOJIS[(i + offset) % B.EMOJIS.length] }; });
    var meta = formatMeta(NB.format);
    if (meta.modes && meta.modes.indexOf(NB.mode) < 0) throw new Error(meta.label + ' is only for ' + meta.modes.join(' or '));
    if (players.length < 2) throw new Error('Add at least ' + Math.max(2, meta.minPlayers || 2) + ' names to see the draw.');

    var opts = { mode: NB.mode, format: NB.format, courts: NB.courts, rng: rng };
    var ids = players.map(function (p) { return p.id; });
    if (NB.format === 'americano') {
      if (NB.rounds !== '') opts.rounds = Math.max(1, Math.min(60, Math.floor(Number(NB.rounds)) || 1));
    } else if (NB.mode === 'doubles') {
      if (ids.length % 2) throw new Error('Doubles with fixed teams needs an even number of players. Add or remove one, or try Rotating partners.');
      opts.teams = F.makeTeams(ids, NB.teams === 'random', rng);
      if (NB.format === 'knockout' && NB.seeding === 'random') opts.teams = shuffle(opts.teams, rng);
    }
    if (NB.mode === 'singles' && NB.format === 'knockout' && NB.seeding === 'random') {
      players = shuffle(players, rng);
    }
    if (NB.format === 'pools_playoff') opts.playoffSize = Number(NB.playoffSize) || 4;
    opts.players = players;
    var data = F.generate(opts);
    // keep the roster in the order it was typed, whatever the draw did
    data.players = names.map(function (n, i) { return players.filter(function (p) { return p.id === 'p' + (i + 1); })[0]; });
    return data;
  }

  function refreshPreview() {
    try {
      NB.preview = buildData();
      NB.error = null;
    } catch (e) {
      NB.preview = null;
      NB.error = e.message;
    }
    renderPreview();
  }

  function renderBuilder(root) {
    if (!B.isUmpire()) {
      root.innerHTML = B.win('🏆 NEW_TOURNAMENT.EXE',
        '<div class="empty-note"><p style="font-size:38px;margin:0">🧑‍⚖️🔒</p>' +
        '<p>Only umpires can draw up a new tournament.</p>' +
        '<div class="btn-row" style="justify-content:center"><button type="button" class="primary" id="nb-login">🔒 Umpire login</button>' +
        '<a class="w95-btn" href="/">Back to Centre Court</a></div></div>');
      return;
    }
    var formats = F.FORMATS.map(function (f) {
      var allowed = f.modes.indexOf(NB.mode) > -1;
      return '<label class="format-opt' + (allowed ? '' : ' disabled') + '">' +
        '<input type="radio" name="nb-format" value="' + f.key + '"' + (NB.format === f.key ? ' checked' : '') + (allowed ? '' : ' disabled') + '>' +
        '<b>' + esc(f.label) + (allowed ? '' : ' <span class="small">(doubles only)</span>') + '</b>' +
        '<span class="small">' + esc(f.blurb) + '</span></label>';
    }).join('');

    var teamFormat = NB.mode === 'doubles' && NB.format !== 'americano';
    root.innerHTML =
      B.win('🏆 NEW_TOURNAMENT.EXE',
        '<form id="nb-form" autocomplete="off">' +
        '<div class="form-grid">' +
          '<div><label for="nb-title">Tournament name</label><input type="text" id="nb-title" maxlength="80" value="' + esc(NB.title) + '" placeholder="The Gentlemen\'s Singles"></div>' +
          '<div><label for="nb-date">Date</label><input type="date" id="nb-date" value="' + esc(NB.date) + '"></div>' +
          '<div class="full"><label for="nb-names">Players <span class="small muted" id="nb-count"></span></label>' +
            '<textarea class="names" id="nb-names" placeholder="One name per line&#10;Serena-ish&#10;Big Dave&#10;Lobzilla&#10;Net Cord Nancy">' + esc(NB.names) + '</textarea></div>' +
          '<div class="full"><label>Singles or doubles?</label><div class="seg" role="group" aria-label="Singles or doubles">' +
            '<button type="button" data-mode="singles" aria-pressed="' + (NB.mode === 'singles') + '">🎾 Singles</button>' +
            '<button type="button" data-mode="doubles" aria-pressed="' + (NB.mode === 'doubles') + '">🎾🎾 Doubles</button></div></div>' +
          '<div class="full"><label>Format</label><div class="format-list">' + formats + '</div></div>' +
          (teamFormat
            ? '<div><label for="nb-teams">Doubles teams</label><select id="nb-teams">' +
                '<option value="random"' + (NB.teams === 'random' ? ' selected' : '') + '>Random pairs</option>' +
                '<option value="listed"' + (NB.teams === 'listed' ? ' selected' : '') + '>As listed (1st + 2nd, 3rd + 4th...)</option></select></div>'
            : '') +
          (NB.format === 'knockout'
            ? '<div><label for="nb-seeding">Draw</label><select id="nb-seeding">' +
                '<option value="random"' + (NB.seeding === 'random' ? ' selected' : '') + '>Random draw</option>' +
                '<option value="listed"' + (NB.seeding === 'listed' ? ' selected' : '') + '>Seeded as listed (top = No. 1 seed)</option></select></div>'
            : '') +
          '<div><label for="nb-courts">Courts available</label><input type="number" id="nb-courts" min="1" max="12" value="' + NB.courts + '"></div>' +
          (NB.format === 'americano'
            ? '<div><label for="nb-rounds">Rounds</label><input type="number" id="nb-rounds" min="1" max="60" value="' + esc(NB.rounds) + '" placeholder="auto"></div>'
            : '') +
          (NB.format === 'pools_playoff'
            ? '<div><label for="nb-playoff">Playoff spots</label><select id="nb-playoff">' +
                [2, 4, 8].map(function (n) { return '<option value="' + n + '"' + (Number(NB.playoffSize) === n ? ' selected' : '') + '>Top ' + n + (n === 2 ? ' (straight to a final)' : n === 4 ? ' (semis + final)' : ' (quarters, semis, final)') + '</option>'; }).join('') +
                '</select></div>'
            : '') +
        '</div>' +
        '</form>') +
      '<div id="nb-preview"></div>';
    renderPreview();
  }

  function renderPreview() {
    var box = document.getElementById('nb-preview');
    if (!box) return;
    var count = document.getElementById('nb-count');
    if (count) count.textContent = '(' + parseNames(NB.names).length + ' so far · one per line)';

    if (!NB.preview) {
      box.innerHTML = B.win('🔮 PREVIEW.EXE', '<p class="empty-note">' + esc(NB.error || 'Add some names to see the draw.') + '</p>');
      return;
    }
    var d = NB.preview;
    var prog = F.progress(d);
    var rr = F.rounds(d, 'rr');
    var ko = F.rounds(d, 'ko');
    var c = F.coverage(d);
    var stats = '<div class="preview-stats">' +
      '<div class="stat"><b>' + prog.total + '</b>matches' + (d.format === 'pools_playoff' ? ' before playoffs' : '') + '</div>' +
      '<div class="stat"><b>' + (rr.length || ko.length) + '</b>' + (rr.length ? 'rounds' : 'knockout rounds') + '</div>' +
      (rr.length ? '<div class="stat"><b>' + c.matchesPerPlayer.min + (c.matchesPerPlayer.max !== c.matchesPerPlayer.min ? '-' + c.matchesPerPlayer.max : '') + '</b>matches each</div>' : '') +
      (rr.length ? '<div class="stat"><b>' + pct(c.opponents) + '%</b>opponent coverage</div>' : '') +
      (c.partners ? '<div class="stat"><b>' + pct(c.partners) + '%</b>partner coverage</div>' : '') +
      '</div>';

    var teams = '';
    if (d.teams && d.teams.length) {
      teams = '<p style="margin:8px 0 4px"><b>Teams</b></p><div class="w95-table-wrap"><table><tbody>' +
        d.teams.map(function (t, i) { return '<tr><td class="rank-cell">' + (i + 1) + '</td><td>' + sideHtml(d, t.players) + '</td></tr>'; }).join('') +
        '</tbody></table></div>';
    }

    var sample = (rr.length ? rr : ko).slice(0, 3);
    var play = '<p style="margin:10px 0 4px"><b>First ' + (sample.length === 1 ? 'round' : sample.length + ' rounds') + ' of play</b></p>' +
      sample.map(function (r) { return roundHtml(d, r, false); }).join('') +
      ((rr.length || ko.length) > 3 ? '<p class="small muted">…and ' + ((rr.length || ko.length) - 3) + ' more round(s).</p>' : '');

    box.innerHTML = B.win('🔮 PREVIEW.EXE',
      stats + (rr.length ? coverageHtml(d) : '') + teams + play +
      '<div class="btn-row"><button type="button" id="nb-shuffle">🎲 Reshuffle the draw</button><span class="grow"></span>' +
      '<button type="button" class="primary" id="nb-start">🎾 Start tournament</button></div>',
      '', '<span>' + esc(formatMeta(d.format).label) + ' · ' + d.mode + '</span><span>' + d.players.length + ' players · ' + d.courts + ' court(s)</span>');
  }

  async function startTournament() {
    if (!NB.preview) return;
    var title = (document.getElementById('nb-title').value || '').trim() ||
      (NB.mode === 'doubles' ? 'The Doubles Championship' : 'The Singles Championship');
    var date = document.getElementById('nb-date').value || B.today();
    var btn = document.getElementById('nb-start');
    btn.disabled = true;
    try {
      var ev = await B.api('/events', { method: 'POST', body: { kind: 'tournament', title: title, date: date, data: NB.preview } });
      B.bleep('tada');
      location.href = '/tournament.html?id=' + ev.id;
    } catch (e) {
      btn.disabled = false;
      if (e.status === 401) { if (await B.loginDialog()) startTournament(); return; }
      B.showDialog({ title: 'NEW_TOURNAMENT.EXE', icon: '❌', body: 'Could not start it: <b>' + esc(e.message) + '</b>' });
    }
  }

  function wireBuilder(root) {
    root.addEventListener('input', function (e) {
      var id = e.target.id;
      if (id === 'nb-title') { NB.title = e.target.value; return; }
      if (id === 'nb-date') { NB.date = e.target.value; return; }
      if (id === 'nb-names') { NB.names = e.target.value; refreshPreview(); return; }
      if (id === 'nb-courts') { NB.courts = Math.max(1, Math.min(12, Math.floor(Number(e.target.value)) || 1)); refreshPreview(); return; }
      if (id === 'nb-rounds') { NB.rounds = e.target.value; refreshPreview(); return; }
    });
    root.addEventListener('change', function (e) {
      var t = e.target;
      if (t.name === 'nb-format') { NB.format = t.value; renderBuilder(root); refreshPreview(); return; }
      if (t.id === 'nb-teams') { NB.teams = t.value; refreshPreview(); return; }
      if (t.id === 'nb-seeding') { NB.seeding = t.value; refreshPreview(); return; }
      if (t.id === 'nb-playoff') { NB.playoffSize = Number(t.value); refreshPreview(); return; }
    });
    root.addEventListener('click', function (e) {
      var t = e.target;
      if (t.closest('#nb-login')) { B.loginDialog(); return; }
      var modeBtn = t.closest('[data-mode]');
      if (modeBtn) {
        NB.mode = modeBtn.getAttribute('data-mode');
        if (NB.mode === 'singles' && NB.format === 'americano') NB.format = 'round_robin';
        renderBuilder(root);
        refreshPreview();
        return;
      }
      if (t.closest('#nb-shuffle')) { NB.seed = Math.floor(Math.random() * 1e9); refreshPreview(); B.bleep('ok'); return; }
      if (t.closest('#nb-start')) { startTournament(); return; }
    });
    document.addEventListener('blitz:auth', function () { renderBuilder(root); refreshPreview(); });
  }

  /* =====================================================================
     VIEWER
     ===================================================================== */

  var T = { id: null, ev: null, tab: null, saving: false, sync: 'connecting…' };

  function canEdit() { return B.isUmpire() && T.ev && T.ev.status === 'live'; }

  function roundHtml(data, r, interactive) {
    var pm = playerMap(data);
    var isKo = r.matches.length && r.matches[0].stage === 'ko';
    var head = isKo ? (r.matches[0].label || 'Round ' + r.round) : 'Round ' + r.round;
    var resting = r.resting && r.resting.length
      ? '<span class="resting">resting: ' + r.resting.map(function (id) { return pm[id] ? esc(pm[id].emoji + ' ' + pm[id].name) : '?'; }).join(', ') + '</span>'
      : '';
    return '<div class="round-block"><div class="round-head"><span>' + esc(head) + '</span>' + resting + '</div>' +
      r.matches.map(function (m) { return matchHtml(data, m, interactive, pm); }).join('') + '</div>';
  }

  function matchHtml(data, m, interactive, pm) {
    var aWon = m.score && m.score[0] > m.score[1];
    var bWon = m.score && m.score[1] > m.score[0];
    var court = m.stage === 'ko' ? (m.bye ? 'bye' : 'Match ' + (m.slot + 1)) : 'Court ' + (m.court || 1);
    var ready = m.a.length && m.b.length && !m.bye;
    var mid;
    if (m.bye) {
      mid = '<span class="score-static small">walkover</span>';
    } else if (interactive && ready) {
      mid = '<button type="button" class="score-btn' + (m.score ? '' : ' unplayed') + '" data-match="' + esc(m.id) + '">' +
        (m.score ? m.score[0] + ' - ' + m.score[1] : '✏️ Enter score') + '</button>';
    } else {
      mid = '<span class="score-static">' + (m.score ? m.score[0] + ' - ' + m.score[1] : 'vs') + '</span>';
    }
    return '<div class="match' + (m.score ? ' done' : '') + (m.bye ? ' bye' : '') + '">' +
      '<span class="court">' + court + '</span>' +
      '<span class="side a' + (aWon ? ' won' : '') + '">' + sideHtml(data, m.a, pm) + '</span>' +
      mid +
      '<span class="side b' + (bWon ? ' won' : '') + '">' + sideHtml(data, m.b, pm) + '</span>' +
      '</div>';
  }

  function hasRR(data) { return data.format !== 'knockout'; }
  function hasKO(data) { return data.matches.some(function (m) { return m.stage === 'ko'; }); }

  function playTab(data) {
    var edit = canEdit();
    var html = '';
    var rr = F.rounds(data, 'rr');
    var ko = F.rounds(data, 'ko');
    if (rr.length) html += rr.map(function (r) { return roundHtml(data, r, edit); }).join('');
    if (data.format === 'pools_playoff') {
      var rrDone = data.matches.filter(function (m) { return m.stage === 'rr'; }).every(function (m) { return m.score; });
      html += '<h3 style="margin:16px 0 6px">🏆 Playoffs (top ' + (data.settings.playoffSize || 4) + ')</h3>';
      if (!ko.length) {
        html += rrDone
          ? (edit ? '<div class="notice">Round robin complete! Seed the playoffs from the standings.<div class="btn-row"><button type="button" class="primary" id="tv-playoffs">🏆 Start playoffs</button></div></div>'
                  : '<p class="notice">Round robin complete. Waiting for the umpire to seed the playoffs.</p>')
          : '<p class="small muted">The top ' + (data.settings.playoffSize || 4) + ' after the round robin go through. Finish every match above first.</p>';
      }
    }
    if (ko.length) html += ko.map(function (r) { return roundHtml(data, r, edit); }).join('');
    return html || '<p class="empty-note">No matches. Suspicious.</p>';
  }

  function standingsTab(data) {
    var rows = F.standings(data);
    var am = data.format === 'americano';
    var draws = rows.some(function (r) { return r.drawn; });
    var anyPlayed = rows.some(function (r) { return r.played; });
    var head = '<tr><th class="rank-cell">#</th><th>' + (am || data.mode === 'singles' ? 'Player' : 'Team') + '</th>' +
      '<th class="num-cell">P</th>' +
      (am ? '<th class="num-cell">Games</th><th class="num-cell">W</th>' : '<th class="num-cell">W</th><th class="num-cell">L</th>' + (draws ? '<th class="num-cell">D</th>' : '') + '<th class="num-cell hide-sm">Games</th>') +
      '<th class="num-cell">+/-</th></tr>';
    var cut = data.format === 'pools_playoff' ? (data.settings.playoffSize || 4) : 0;
    var body = rows.map(function (r, i) {
      var cls = [];
      if (anyPlayed && r.rank <= 3) cls.push('rank-' + r.rank);
      var badge = !anyPlayed ? (i + 1) + '.' : r.rank === 1 ? '👑' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : r.rank + '.';
      var style = cut && i === cut - 1 ? ' style="border-bottom:3px double var(--wb-purple)"' : '';
      return '<tr class="' + cls.join(' ') + '"' + style + '><td class="rank-cell">' + badge + '</td>' +
        '<td><span class="player-name">' + sideHtml(data, r.players) + '</span></td>' +
        '<td class="num-cell">' + r.played + '</td>' +
        (am ? '<td class="pts-cell">' + r.gf + '</td><td class="num-cell">' + r.won + '</td>'
            : '<td class="pts-cell">' + r.won + '</td><td class="num-cell">' + r.lost + '</td>' + (draws ? '<td class="num-cell">' + r.drawn + '</td>' : '') +
              '<td class="num-cell hide-sm">' + r.gf + '-' + r.ga + '</td>') +
        '<td class="num-cell">' + (r.diff > 0 ? '+' : '') + r.diff + '</td></tr>';
    }).join('');
    return '<div class="w95-table-wrap"><table><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>' +
      '<p class="small muted" style="margin:6px 0 10px">' +
        (am ? 'Ranked by total games won, then matches won, then game difference.' : 'Ranked by matches won, then game difference, then games won.') +
        (cut ? ' The top ' + cut + ' (above the double line) make the playoffs.' : '') +
      '</p>' +
      '<fieldset><legend>Coverage</legend>' + coverageHtml(data) + '</fieldset>';
  }

  function drawTab(data) {
    var ko = F.rounds(data, 'ko');
    if (!ko.length) return '<p class="empty-note">The draw appears once the playoffs are seeded.</p>';
    var edit = canEdit();
    var pm = playerMap(data);
    return '<div class="bracket-wrap"><div class="bracket">' + ko.map(function (r) {
      return '<div class="bracket-col"><h4>' + esc(r.matches[0].label || 'Round ' + r.round) + '</h4><div class="bracket-matches">' +
        r.matches.map(function (m) {
          var aWon = m.score && m.score[0] > m.score[1], bWon = m.score && m.score[1] > m.score[0];
          var ready = m.a.length && m.b.length && !m.bye;
          return '<div class="b-match' + (edit && ready ? ' clickable" data-match="' + esc(m.id) + '" role="button" tabindex="0" title="Enter score' : '') + '">' +
            '<div class="b-side' + (aWon || (m.bye && m.a.length) ? ' won' : '') + '"><span>' + sideHtml(data, m.a, pm) + '</span><span class="s">' + (m.score ? m.score[0] : '') + '</span></div>' +
            '<div class="b-side' + (bWon || (m.bye && m.b.length) ? ' won' : '') + '"><span>' + (m.bye && !m.b.length ? '<span class="tbd">bye</span>' : sideHtml(data, m.b, pm)) + '</span><span class="s">' + (m.score ? m.score[1] : '') + '</span></div>' +
            '</div>';
        }).join('') + '</div></div>';
    }).join('') + '</div></div>';
  }

  function renderViewer(root) {
    var ev = T.ev;
    if (!ev) return;
    var d = ev.data;
    var tabs = [];
    tabs.push({ key: 'play', label: '📋 Order of play' });
    if (hasRR(d)) tabs.push({ key: 'standings', label: '📊 Standings' });
    if (d.format === 'knockout' || hasKO(d)) tabs.push({ key: 'draw', label: '🌳 Draw' });
    var tab = T.tab && tabs.some(function (t) { return t.key === T.tab; }) ? T.tab : (d.format === 'knockout' ? 'draw' : 'play');

    var prog = F.progress(d);
    var champIds = F.champion(d);
    var banner = '';
    if (ev.status === 'finished') {
      banner = '<div class="champion-banner"><span class="trophy">🏆</span>Champion' + (String(ev.winner || '').indexOf('&') > -1 ? 's' : '') +
        '<br><span class="names">' + esc(ev.winner || '???') + '</span></div>';
    } else if (champIds) {
      banner = '<div class="champion-banner"><span class="trophy">🏆</span>' + (d.format === 'knockout' || d.format === 'pools_playoff' ? 'Champion decided!' : 'All matches played. Top of the table:') +
        '<br><span class="names">' + esc(sideText(d, champIds)) + '</span>' +
        '<div class="umpire-only btn-row" style="justify-content:center"><button type="button" class="primary" id="tv-finish">🏁 Finish &amp; add to Roll of Champions</button></div></div>';
    }

    var ctrl = root.querySelector('#tv-ctrl');
    var ctrlOpen = ctrl && !ctrl.classList.contains('collapsed');
    var focusMatch = document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute('data-match');
    var scrollY = window.scrollY;

    root.innerHTML =
      B.win('🏆 ' + esc(ev.title.toUpperCase()),
        banner +
        '<p style="margin:0 0 8px">' + B.fmtDate(ev.date) + ' · <b>' + (d.mode === 'doubles' ? 'Doubles' : 'Singles') + '</b> · ' + esc(formatMeta(d.format).label) +
          ' · ' + d.players.length + ' players · ' + d.courts + ' court(s)</p>' +
        '<div class="meter-row" style="margin-bottom:10px"><span>Matches played</span><div class="meter"><i style="width:' + (prog.total ? Math.round(100 * prog.played / prog.total) : 0) + '%"></i></div><b>' + prog.played + '/' + prog.total + '</b></div>' +
        '<p class="notice spectator-only">👀 Watching live. Results appear on their own. Umpires <a href="#" id="tv-login">log in</a> to enter scores.</p>' +
        (canEdit() ? '<p class="small muted" style="margin:0 0 8px">Tap a match to enter its score (games won by each side).</p>' : '') +
        '<div class="tabs" role="tablist">' + tabs.map(function (t) {
          return '<button type="button" role="tab" data-tab="' + t.key + '" aria-selected="' + (t.key === tab) + '">' + t.label + '</button>';
        }).join('') + '</div>' +
        '<div class="tab-panel">' + (tab === 'play' ? playTab(d) : tab === 'standings' ? standingsTab(d) : drawTab(d)) + '</div>',
        'id="tv-win"',
        '<span>' + (ev.status === 'finished' ? '🏁 finished' : '● live') + '</span><span id="tv-sync">' + esc(T.sync) + '</span>') +

      '<section class="win95-window umpire-only' + (ctrlOpen ? '' : ' collapsed') + '" id="tv-ctrl">' +
        '<div class="titlebar"><span class="titlebar-text">🔧 Umpire controls</span>' +
          '<span class="titlebar-controls"><button type="button" data-action="min" aria-label="Minimize">▁</button>' +
          '<button type="button" data-action="close" aria-label="Close">✕</button></span></div>' +
        '<div class="win95-body"><div class="btn-row" style="margin-top:0">' +
          '<button type="button" id="tv-rename">✏️ Rename</button>' +
          (ev.status === 'finished' ? '<button type="button" id="tv-reopen">↩️ Reopen</button>' : '') +
          '<button type="button" id="tv-delete" class="danger">🗑️ Delete tournament</button>' +
        '</div></div>' +
      '</section>';

    window.scrollTo(0, scrollY);
    if (focusMatch) {
      var again = root.querySelector('[data-match="' + focusMatch + '"]');
      if (again) again.focus();
    }
    document.title = ev.title + " · Weembledon '95";

    var msgs = [ev.title.toUpperCase() + ' · ' + formatMeta(d.format).label.toUpperCase(), prog.played + ' OF ' + prog.total + ' MATCHES PLAYED'];
    if (hasRR(d)) {
      var st = F.standings(d);
      if (st.length && st[0].played) msgs.push('👑 TOP OF THE TABLE: ' + sideText(d, st[0].players).toUpperCase());
    }
    if (ev.status === 'finished') msgs.push('🏆 CHAMPION: ' + String(ev.winner || '').toUpperCase());
    else if (champIds) msgs.push('🏆 CHAMPION DECIDED: ' + sideText(d, champIds).toUpperCase());
    msgs.push('🍓 QUIET PLEASE. MOBILE PHONES TO SILENT. STRAWBERRIES TO MOUTH');
    B.setTicker(msgs);
  }

  function setSync(text) {
    T.sync = text;
    var el = document.getElementById('tv-sync');
    if (el) el.textContent = text;
  }

  async function saveT(root, change, label) {
    T.saving = true;
    setSync('🟡 saving…');
    try {
      T.ev = await B.saveEvent(T.ev, change);
      setSync('🟢 live · saved');
      renderViewer(root);
      return true;
    } catch (e) {
      setSync('🟢 live');
      if (e.status === 401) {
        renderViewer(root);
        if (await B.loginDialog()) { T.saving = false; return saveT(root, change, label); }
        return false;
      }
      B.showDialog({ title: label || 'tournament.exe', icon: '❌', body: esc(e.message) });
      return false;
    } finally {
      T.saving = false;
    }
  }

  function scoreDialog(root, matchId) {
    var d = T.ev.data;
    var m = d.matches.filter(function (x) { return x.id === matchId; })[0];
    if (!m) return;
    var uid = 'sc' + Math.random().toString(36).slice(2, 7);
    var dlg = B.showDialog({
      title: 'SCORE_ENTRY.EXE', icon: '🎾',
      body: '<form id="' + uid + '-f" autocomplete="off">' +
        '<label for="' + uid + '-a" style="margin-top:0">' + sideHtml(d, m.a) + '</label>' +
        '<input id="' + uid + '-a" type="number" min="0" max="99" inputmode="numeric" value="' + (m.score ? m.score[0] : '') + '" style="width:100%">' +
        '<label for="' + uid + '-b">' + sideHtml(d, m.b) + '</label>' +
        '<input id="' + uid + '-b" type="number" min="0" max="99" inputmode="numeric" value="' + (m.score ? m.score[1] : '') + '" style="width:100%">' +
        '<p class="small muted" style="margin:8px 0 0">Games won by each side' + (m.stage === 'ko' ? '. Knockout matches need a winner.' : '.') + '</p>' +
        '</form>',
      buttons: [
        { label: 'Save score', primary: true, onClick: function () { submit(); } },
        m.score ? { label: 'Clear result', onClick: function () { apply(null, null); } } : null,
        { label: 'Cancel' }
      ].filter(Boolean)
    });
    var a = document.getElementById(uid + '-a');
    a.focus();
    document.getElementById(uid + '-f').addEventListener('submit', function (e) { e.preventDefault(); submit(); dlg.close(); });

    function submit() {
      var va = document.getElementById(uid + '-a').value, vb = document.getElementById(uid + '-b').value;
      if (va === '' || vb === '') {
        setTimeout(function () { B.showDialog({ title: 'SCORE_ENTRY.EXE', icon: '⚠️', body: 'Enter a score for both sides.' }); }, 0);
        return;
      }
      apply(Math.floor(Number(va)), Math.floor(Number(vb)));
    }
    function apply(x, y) {
      var before = F.champion(T.ev.data);
      saveT(root, function (data) { F.setScore(data, matchId, x, y); }, 'SCORE_ENTRY.EXE').then(function (saved) {
        if (!saved) return;
        B.bleep(x === null ? 'down' : 'up');
        if (!before && F.champion(T.ev.data) && B.mascotSay) {
          B.mascotSay('we have a champion! umpire, press the big finish button and cue the polite applause.');
        }
      });
    }
  }

  async function finishT(root) {
    var ids = F.champion(T.ev.data);
    if (!ids) return;
    var label = sideText(T.ev.data, ids);
    var yes = await B.confirm95('Finish <b>' + esc(T.ev.title) + '</b> and engrave <b>' + esc(label) + '</b> on the Roll of Champions?', {
      title: 'Crown the champion', icon: '🏆', yes: 'Engrave it', no: 'Not yet'
    });
    if (!yes) return;
    if (await saveT(root, function (data) {
      var w = F.champion(data);
      return { status: 'finished', winner: w ? sideText(data, w) : label };
    }, 'Finish')) {
      B.bleep('tada');
      if (B.mascotSay) B.mascotSay('champion engraved. the trophy is imaginary but the glory is real.');
    }
  }

  function wireViewer(root) {
    root.addEventListener('click', function (e) {
      var t = e.target;
      var tabBtn = t.closest('[data-tab]');
      if (tabBtn) { T.tab = tabBtn.getAttribute('data-tab'); renderViewer(root); return; }
      if (t.closest('#tv-login')) { e.preventDefault(); B.loginDialog(); return; }
      var mBtn = t.closest('[data-match]');
      if (mBtn && canEdit()) { scoreDialog(root, mBtn.getAttribute('data-match')); return; }
      if (t.closest('#tv-finish')) { finishT(root); return; }
      if (t.closest('#tv-playoffs')) {
        saveT(root, function (data) { F.startPlayoffs(data); }, 'Playoffs').then(function (ok) {
          if (ok) { T.tab = 'draw'; renderViewer(root); B.bleep('tada'); }
        });
        return;
      }
      if (t.closest('#tv-reopen')) { saveT(root, function () { return { status: 'live', winner: null }; }, 'Reopen'); return; }
      if (t.closest('#tv-rename')) {
        B.prompt95('New name:', { title: 'RENAME.EXE', value: T.ev.title, maxlength: 80 }).then(function (v) {
          if (v && v.trim()) saveT(root, function () { return { title: v.trim() }; }, 'Rename');
        });
        return;
      }
      if (t.closest('#tv-delete')) {
        B.confirm95('Delete <b>' + esc(T.ev.title) + '</b> for good? It also leaves the Roll of Champions.', { title: 'Delete tournament', icon: '🗑️', yes: 'Delete it', no: 'Keep it' })
          .then(async function (yes) {
            if (!yes) return;
            try { await B.api('/events/' + T.ev.id, { method: 'DELETE', body: {} }); location.href = '/'; }
            catch (err) { B.showDialog({ title: 'Delete', icon: '❌', body: 'Could not delete: <b>' + esc(err.message) + '</b>' }); }
          });
      }
    });
    root.addEventListener('keydown', function (e) {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('b-match') && canEdit()) {
        e.preventDefault();
        scoreDialog(root, e.target.getAttribute('data-match'));
      }
    });
    document.addEventListener('blitz:auth', function () { renderViewer(root); });
  }

  /* ---------- boot ---------- */

  document.addEventListener('DOMContentLoaded', function () {
    var root = document.getElementById('page-tournament');
    if (!root) return;
    var id = B.param('id');
    var isNew = B.param('new');
    B.buildChrome('tournament', { subtitle: isNew ? 'the draw is being made' : 'quiet please' });

    if (!id) {
      if (!isNew) { location.href = '/'; return; }
      wireBuilder(root);
      renderBuilder(root);
      refreshPreview();
      B.checkUmpire();
      return;
    }

    T.id = id;
    root.innerHTML = B.win('🏆 TOURNAMENT.EXE', '<p class="empty-note blink">Rolling the covers off…</p>');
    wireViewer(root);
    (async function () {
      B.checkUmpire();
      try {
        T.ev = await B.api('/events/' + encodeURIComponent(id));
        if (T.ev.kind !== 'tournament') { location.replace('/scoreboard.html?id=' + T.ev.id); return; }
        setSync('🟢 live');
        renderViewer(root);
      } catch (e) {
        root.innerHTML = B.win('🏆 TOURNAMENT.EXE', '<p class="empty-note">Could not load this tournament: <b>' + esc(e.message) + '</b><br><a href="/">Back to Centre Court</a></p>');
        return;
      }
      B.watchEvent(T.ev.id, function () { return T.saving ? null : T.ev.version; }, function (ev) {
        if (T.saving) return;
        // do not yank the page out from under an open score dialog
        T.ev = ev;
        if (document.querySelector('.w95-dialog-overlay')) {
          var wait = setInterval(function () {
            if (document.querySelector('.w95-dialog-overlay')) return;
            clearInterval(wait);
            renderViewer(root);
          }, 500);
          return;
        }
        setSync('🟢 live');
        renderViewer(root);
      }, function (err, n) {
        if (err.status === 404) { setSync('🔴 this tournament was deleted'); return; }
        setSync(n > 2 ? '🔴 offline · retrying' : '🟡 reconnecting…');
      });
    })();
  });
})();
