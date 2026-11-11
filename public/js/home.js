/* Weembledon '95 - Centre Court (home): what's on now, the roll of champions, start something new */
window.Blitz = window.Blitz || { pages: {} };

(function () {
  var B = window.Blitz;
  var esc = B.esc;
  var S = { events: null, root: null, error: null };

  function href(e) { return (e.kind === 'tournament' ? '/tournament' : '/scoreboard') + '?id=' + e.id; }
  function chip(e) { return '<span class="kind-chip">' + (e.kind === 'tournament' ? '🏆 Tournament' : '📟 Scoreboard') + '</span>'; }

  function liveTable(list) {
    if (!list.length) {
      return '<p class="empty-note">Nothing on court right now. The groundskeeper is napping.' +
        '<span class="umpire-only"><br>Start something in the window below.</span></p>';
    }
    return '<div class="w95-table-wrap"><table><tbody>' + list.map(function (e) {
      return '<tr class="event-row" data-href="' + href(e) + '">' +
        '<td><span class="event-title">' + esc(e.title) + '</span><br><span class="small muted">' + B.fmtDate(e.date) + '</span></td>' +
        '<td class="hide-sm">' + chip(e) + '</td>' +
        '<td class="num-cell"><span class="live-dot blink">● LIVE</span></td>' +
        '<td class="num-cell"><a class="w95-btn icon-btn" href="' + href(e) + '">Open ➜</a></td>' +
        '</tr>';
    }).join('') + '</tbody></table></div>';
  }

  function champsTable(list) {
    if (!list.length) {
      return '<p class="empty-note">No champions crowned yet. The trophy cabinet echoes.</p>';
    }
    return '<div class="w95-table-wrap"><table>' +
      '<thead><tr><th>Date</th><th>Event</th><th>Champion</th></tr></thead><tbody>' +
      list.map(function (e, i) {
        return '<tr class="event-row' + (i === 0 ? ' rank-1' : '') + '" data-href="' + href(e) + '">' +
          '<td class="small" style="white-space:nowrap">' + B.fmtDate(e.date) + '</td>' +
          '<td><span class="event-title">' + esc(e.title) + '</span> <span class="hide-sm">' + chip(e) + '</span></td>' +
          '<td><span class="champ-name">🏆 ' + esc(e.winner || 'undecided') + '</span></td>' +
          '</tr>';
      }).join('') + '</tbody></table></div>';
  }

  function render() {
    var root = S.root;
    if (S.events === null) {
      root.innerHTML = B.win('📺 ON COURT NOW', S.error
        ? '<p class="empty-note">Could not reach the scoreboard: <b>' + esc(S.error) + '</b><br>Retrying shortly.</p>'
        : '<p class="empty-note blink">Rolling the covers off…</p>');
      return;
    }
    var live = S.events.filter(function (e) { return e.status === 'live'; });
    var done = S.events.filter(function (e) { return e.status === 'finished'; });

    root.innerHTML =
      B.win('📺 ON COURT NOW', liveTable(live), '', '<span>' + live.length + ' live event(s)</span><span>refreshes on its own</span>') +
      B.win('🏆 ROLL OF CHAMPIONS', champsTable(done), '', '<span>' + done.length + ' champion(s) crowned</span><span>engraved forever (ish)</span>') +
      B.win('🎾 START SOMETHING',
        '<div class="umpire-only"><div class="new-grid">' +
          '<button type="button" class="new-card" id="new-scoreboard"><span class="big">📟</span><b>Quick scoreboard</b>' +
            '<span class="small">Add players, tap + and - as points happen, tabulate standings at the end.</span></button>' +
          '<button type="button" class="new-card" id="new-tournament"><span class="big">🏆</span><b>Tournament</b>' +
            '<span class="small">Singles or doubles. Round robin, rotating partners, knockout, or pools then playoffs.</span></button>' +
        '</div></div>' +
        '<div class="spectator-only"><p style="margin-top:0">Spectators can watch everything. Umpires log in to keep score and start new events.</p>' +
          '<button type="button" id="home-login">🔒 Umpire login</button></div>');

    var ticker = ['WELCOME TO THE ROLAX WEEMBLEDON CHAMPIONSHIPS \'95'];
    if (live.length) ticker.push('📺 NOW ON COURT: ' + live.map(function (e) { return e.title.toUpperCase(); }).join(' · '));
    if (done.length && done[0].winner) ticker.push('🏆 REIGNING CHAMPION: ' + done[0].winner.toUpperCase() + ' (' + done[0].title.toUpperCase() + ')');
    ticker.push('🍓 STRAWBERRIES AND CREAM AVAILABLE AT THE CONCESSION STAND (YOUR OWN FRIDGE)');
    ticker.push('PLEASE SWITCH OFF YOUR PAGERS DURING PLAY');
    B.setTicker(ticker);
  }

  async function load() {
    try {
      S.events = await B.api('/events');
      S.error = null;
    } catch (e) {
      S.error = e.message;
    }
    render();
  }

  async function newScoreboard() {
    var title = await B.prompt95('Name this scoreboard:', {
      title: 'NEW_SCOREBOARD.EXE', icon: '📟', value: 'Quick scores · ' + B.fmtDate(B.today()), maxlength: 80, yes: 'Create'
    });
    if (title === null) return;
    title = title.trim() || 'Quick scores';
    try {
      var ev = await B.api('/events', { method: 'POST', body: { kind: 'scoreboard', title: title, date: B.today(), data: { players: [], scores: {} } } });
      location.href = '/scoreboard?id=' + ev.id;
    } catch (e) {
      if (e.status === 401) { if (await B.loginDialog()) newScoreboard(); return; }
      B.showDialog({ title: 'NEW_SCOREBOARD.EXE', icon: '❌', body: 'Could not create it: <b>' + esc(e.message) + '</b>' });
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    S.root = document.getElementById('page-home');
    if (!S.root) return;
    B.buildChrome('home', { subtitle: 'quiet please' });
    S.root.addEventListener('click', function (e) {
      if (e.target.closest('#new-scoreboard')) return newScoreboard();
      if (e.target.closest('#new-tournament')) { location.href = '/tournament?new=1'; return; }
      if (e.target.closest('#home-login')) return B.loginDialog();
      if (e.target.closest('a')) return;
      var row = e.target.closest('[data-href]');
      if (row) location.href = row.getAttribute('data-href');
    });
    render();
    B.checkUmpire();
    load();
    setInterval(function () { if (document.visibilityState === 'visible') load(); }, 15000);
  });
})();
