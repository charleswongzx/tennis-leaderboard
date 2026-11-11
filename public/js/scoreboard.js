/* Weembledon '94 - Quick scoreboard.
   Score entry keeps every player in the order they were added, so the + button
   you are tapping never moves. Standings are a separate tab you tabulate when
   you want them. */
window.Blitz = window.Blitz || { pages: {} };

(function () {
  var B = window.Blitz;
  var esc = B.esc;

  var S = {
    id: null,
    ev: null,
    tab: null,          // 'entry' | 'standings' (null = pick by role)
    pending: {},        // taps not yet sent: { pid: delta }
    inflight: {},       // taps being saved right now
    saving: false,
    flushTimer: null,
    shown: {},          // last rendered score per player, for the bump animation
    emojiIdx: Math.floor(Math.random() * 24),
    syncNote: 'connecting…'
  };

  /* ---------- derived ---------- */

  function players() { return (S.ev && S.ev.data && S.ev.data.players) || []; }
  function isLive() { return S.ev && S.ev.status === 'live'; }
  function canEdit() { return B.isUmpire() && isLive(); }

  function score(pid) {
    var base = (S.ev.data.scores && S.ev.data.scores[pid]) || 0;
    return base + (S.inflight[pid] || 0) + (S.pending[pid] || 0);
  }

  function ranked() {
    var list = players().map(function (p, i) { return { p: p, i: i, score: score(p.id) }; });
    list.sort(function (a, b) { return (b.score - a.score) || (a.i - b.i); });
    list.forEach(function (row) { row.rank = 1 + list.filter(function (o) { return o.score > row.score; }).length; });
    return list;
  }

  function leaders() {
    var r = ranked();
    if (!r.length) return [];
    return r.filter(function (x) { return x.rank === 1; }).map(function (x) { return x.p; });
  }

  function names(list) { return list.map(function (p) { return p.emoji + ' ' + p.name; }).join(' & '); }

  /* ---------- render ---------- */

  function mount(root) {
    root.innerHTML =
      '<section class="win95-window" id="sb-win">' +
        '<div class="titlebar"><span class="titlebar-text" id="sb-title">📟 SCOREBOARD.EXE</span>' +
          '<span class="titlebar-controls"><button type="button" data-action="min" aria-label="Minimize">▁</button>' +
          '<button type="button" data-action="close" aria-label="Close">✕</button></span></div>' +
        '<div class="win95-body">' +
          '<div id="sb-banner"></div>' +
          '<p class="notice spectator-only">👀 You are watching live. Scores update on their own. Umpires <a href="#" id="sb-login">log in</a> to keep score.</p>' +
          '<div class="tabs" role="tablist">' +
            '<button type="button" role="tab" id="tab-entry" data-tab="entry">✏️ Score entry</button>' +
            '<button type="button" role="tab" id="tab-standings" data-tab="standings">🏆 Standings</button>' +
          '</div>' +
          '<div class="tab-panel" id="panel-entry" role="tabpanel"></div>' +
          '<div class="tab-panel" id="panel-standings" role="tabpanel"></div>' +
        '</div>' +
        '<div class="statusbar"><span id="sb-count"></span><span id="sb-sync"></span></div>' +
      '</section>' +

      '<section class="win95-window umpire-only" id="sb-add-win">' +
        '<div class="titlebar"><span class="titlebar-text">➕ ADD_PLAYER.EXE</span>' +
          '<span class="titlebar-controls"><button type="button" data-action="min" aria-label="Minimize">▁</button>' +
          '<button type="button" data-action="close" aria-label="Close">✕</button></span></div>' +
        '<div class="win95-body">' +
          '<form class="add-form" id="add-form" autocomplete="off">' +
            '<button type="button" class="emoji-btn" id="emoji-btn" title="Tap to change emoji" aria-label="Change player emoji"></button>' +
            '<input type="text" id="player-name" maxlength="28" placeholder="Player name, e.g. Ace Ventura" aria-label="Player name">' +
            '<button type="submit" class="primary" id="add-btn">Add player</button>' +
          '</form>' +
          '<p class="small muted" style="margin:8px 0 0">New players join at the bottom of the score entry list.</p>' +
        '</div>' +
      '</section>' +

      '<section class="win95-window umpire-only collapsed" id="sb-panel-win">' +
        '<div class="titlebar"><span class="titlebar-text">🔧 Umpire controls</span>' +
          '<span class="titlebar-controls"><button type="button" data-action="min" aria-label="Minimize">▁</button>' +
          '<button type="button" data-action="close" aria-label="Close">✕</button></span></div>' +
        '<div class="win95-body"><div class="btn-row" style="margin-top:0">' +
          '<button type="button" id="sb-rename">✏️ Rename</button>' +
          '<button type="button" id="sb-finish" class="primary">🏁 Finish &amp; crown champion</button>' +
          '<button type="button" id="sb-reopen">↩️ Reopen</button>' +
          '<button type="button" id="sb-reset" class="danger">💣 Reset scores to 0</button>' +
          '<button type="button" id="sb-delete" class="danger">🗑️ Delete scoreboard</button>' +
        '</div></div>' +
      '</section>';
    showEmoji();
  }

  function render() {
    if (!S.ev) return;
    var ev = S.ev;
    var tab = S.tab || (B.isUmpire() && isLive() ? 'entry' : 'standings');
    document.title = ev.title + " · Weembledon '94";
    document.getElementById('sb-title').textContent = '📟 ' + ev.title.toUpperCase();

    // banner
    var banner = '';
    if (ev.status === 'finished') {
      banner = '<div class="champion-banner"><span class="trophy">🏆</span>Champion' +
        (ev.winner && ev.winner.indexOf('&') > -1 ? 's' : '') + '<br><span class="names">' + esc(ev.winner || '???') + '</span>' +
        '<br><span class="small muted">' + B.fmtDate(ev.date) + ' · final scores below</span></div>';
    }
    document.getElementById('sb-banner').innerHTML = banner;

    // tabs
    ['entry', 'standings'].forEach(function (t) {
      document.getElementById('tab-' + t).setAttribute('aria-selected', String(t === tab));
      document.getElementById('panel-' + t).hidden = t !== tab;
    });

    // keep keyboard focus across re-render
    var active = document.activeElement;
    var focusKey = active && active.closest && active.closest('#panel-entry') ? active.getAttribute('data-key') : null;

    var list = players();
    var edit = canEdit();
    var entry;
    if (!list.length) {
      entry = '<p class="empty-note">No players yet.' +
        (B.isUmpire() ? ' Add the first challenger in ADD_PLAYER.EXE below.' : ' The umpire will add the field shortly.') + '</p>';
    } else {
      entry = '<ol class="entry-list">' + list.map(function (p, i) {
        var sc = score(p.id);
        var bump = S.shown[p.id] !== undefined && S.shown[p.id] !== sc ? ' bump' : '';
        return '<li class="entry-row">' +
          '<span class="entry-no">' + (i + 1) + '</span>' +
          '<div class="player-cell"><span class="player-emoji">' + esc(p.emoji) + '</span>' +
            '<span class="player-name">' + esc(p.name) + '</span>' +
            (edit ? '<button type="button" class="row-del" data-act="del" data-id="' + esc(p.id) + '" data-key="del:' + esc(p.id) + '" title="Remove ' + esc(p.name) + '" aria-label="Remove ' + esc(p.name) + '">✕</button>' : '') +
          '</div>' +
          '<div class="stepper">' +
            (edit ? '<button type="button" class="minus" data-act="minus" data-id="' + esc(p.id) + '" data-key="minus:' + esc(p.id) + '" aria-label="Take a point from ' + esc(p.name) + '">−</button>' : '') +
            '<span class="led' + (sc < 0 ? ' neg' : '') + bump + '"' + (edit ? ' data-act="set" data-id="' + esc(p.id) + '" title="Tap to type an exact score"' : '') + '>' + sc + '</span>' +
            (edit ? '<button type="button" class="plus" data-act="plus" data-id="' + esc(p.id) + '" data-key="plus:' + esc(p.id) + '" aria-label="Give ' + esc(p.name) + ' a point">+</button>' : '') +
          '</div>' +
        '</li>';
      }).join('') + '</ol>';
      entry += '<div class="btn-row"><span class="small muted grow">' +
        (edit ? 'Rows stay put while you score. Tabulate when you want the order.' : 'Listed in the order players joined.') +
        '</span><button type="button" class="primary" id="tabulate">📊 Tabulate standings</button></div>';
    }
    document.getElementById('panel-entry').innerHTML = entry;

    // standings
    var r = ranked();
    var spread = r.length > 1 && r[0].score !== r[r.length - 1].score;
    var standings;
    if (!r.length) {
      standings = '<p class="empty-note">No players, no standings. Very zen.</p>';
    } else {
      standings = '<div class="w95-table-wrap"><table><thead><tr><th class="rank-cell">#</th><th>Player</th><th style="text-align:right">PTS</th></tr></thead><tbody>' +
        r.map(function (row) {
          var cls = [], badge = '·';
          if (spread || r.length === 1) {
            badge = row.rank === 1 ? '👑' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : row.rank + '.';
            if (row.rank <= 3) cls.push('rank-' + row.rank);
            if (r.length > 3 && row.score === r[r.length - 1].score && row.rank > 3) cls.push('rank-last');
          }
          return '<tr class="' + cls.join(' ') + '"><td class="rank-cell">' + badge + '</td>' +
            '<td><div class="player-cell"><span class="player-emoji">' + esc(row.p.emoji) + '</span><span class="player-name">' + esc(row.p.name) + '</span></div></td>' +
            '<td class="pts-cell"><span class="led' + (row.score < 0 ? ' neg' : '') + '">' + row.score + '</span></td></tr>';
        }).join('') + '</tbody></table></div>' +
        (spread ? '' : '<p class="small muted center" style="margin:8px 0 0">Everyone is level. Somebody hit a winner already.</p>');
      if (B.isUmpire() && isLive()) {
        standings += '<div class="btn-row"><button type="button" id="back-to-entry">✏️ Back to score entry</button></div>';
      }
    }
    document.getElementById('panel-standings').innerHTML = standings;

    if (focusKey) {
      var again = document.querySelector('#panel-entry [data-key="' + focusKey + '"]');
      if (again) again.focus();
    }

    S.shown = {};
    list.forEach(function (p) { S.shown[p.id] = score(p.id); });

    document.getElementById('sb-count').textContent = list.length + ' player(s) on court';
    document.getElementById('sb-sync').textContent = S.syncNote;
    document.getElementById('sb-add-win').hidden = !isLive();
    document.getElementById('sb-finish').hidden = !isLive();
    document.getElementById('sb-reset').hidden = !isLive();
    document.getElementById('sb-reopen').hidden = isLive();

    var msgs = [ev.title.toUpperCase()];
    if (r.length && spread) msgs.push('👑 LEADING: ' + r[0].p.name.toUpperCase() + ' (' + r[0].score + ' PTS)');
    if (r.length > 2 && spread) msgs.push('💀 SOMEBODY PLEASE CHECK ON ' + r[r.length - 1].p.name.toUpperCase());
    if (ev.status === 'finished') msgs.push('🏆 CHAMPION: ' + String(ev.winner || '').toUpperCase());
    msgs.push('SCORES UPDATE LIVE FOR EVERY SPECTATOR. NO TAKEBACKS (UNLESS THE UMPIRE PRESSES MINUS)');
    B.setTicker(msgs);
  }

  function setSync(text) {
    S.syncNote = text;
    var el = document.getElementById('sb-sync');
    if (el) el.textContent = text;
  }

  /* ---------- saving ---------- */

  async function save(change, label) {
    try {
      S.ev = await B.saveEvent(S.ev, change);
      setSync('🟢 live · saved');
      render();
      return true;
    } catch (e) {
      if (e.status === 401) {
        render();
        if (await B.loginDialog()) return save(change, label);
        return false;
      }
      B.showDialog({ title: label || 'scoreboard.exe', icon: '❌', body: 'That did not save: <b>' + esc(e.message) + '</b>' });
      return false;
    }
  }

  function scheduleFlush() {
    clearTimeout(S.flushTimer);
    S.flushTimer = setTimeout(flush, 350);
  }

  async function flush() {
    if (S.saving) { scheduleFlush(); return; }
    var keys = Object.keys(S.pending);
    if (!keys.length) return;
    S.saving = true;
    S.inflight = S.pending;
    S.pending = {};
    var deltas = S.inflight;
    setSync('🟡 saving…');
    try {
      S.ev = await B.saveEvent(S.ev, function (data) {
        data.scores = data.scores || {};
        var exists = {};
        (data.players || []).forEach(function (p) { exists[p.id] = true; });
        Object.keys(deltas).forEach(function (pid) {
          if (exists[pid]) data.scores[pid] = (data.scores[pid] || 0) + deltas[pid];
        });
      });
      S.inflight = {};
      setSync('🟢 live · saved');
    } catch (e) {
      // put the taps back so nothing is lost; retry on the next tap or shortly
      Object.keys(deltas).forEach(function (pid) { S.pending[pid] = (S.pending[pid] || 0) + deltas[pid]; });
      S.inflight = {};
      if (e.status === 401) {
        S.pending = {};
        setSync('🔒 logged out · taps not saved');
        B.showDialog({ title: 'UMPIRE_LOGIN.EXE', icon: '🔐', body: 'Your umpire login ran out, so the last taps were not saved. Log in again and re-enter them.' });
      } else {
        setSync('🔴 not saved yet · retrying');
        setTimeout(scheduleFlush, 3000);
      }
    } finally {
      S.saving = false;
      render();
    }
  }

  /* ---------- actions ---------- */

  function showEmoji() {
    var b = document.getElementById('emoji-btn');
    if (b) b.textContent = B.EMOJIS[S.emojiIdx % B.EMOJIS.length];
  }

  async function addPlayer(e) {
    e.preventDefault();
    var input = document.getElementById('player-name');
    var name = input.value.replace(/\s+/g, ' ').trim().slice(0, 28);
    if (!name) {
      B.showDialog({ title: 'name.exe', icon: '⚠️', body: 'Every legend needs a name. Type one in first.' });
      return;
    }
    var emoji = B.EMOJIS[S.emojiIdx % B.EMOJIS.length];
    var btn = document.getElementById('add-btn');
    btn.disabled = true;
    var okSaved = await save(function (data) {
      data.players = data.players || [];
      data.players.push({ id: B.newId('p'), name: name, emoji: emoji });
    }, 'ADD_PLAYER.EXE');
    btn.disabled = false;
    if (okSaved) {
      input.value = '';
      S.emojiIdx = Math.floor(Math.random() * B.EMOJIS.length);
      showEmoji();
      if (B.mascotSay) B.mascotSay(name + ' has entered the lawn. may the odds be ever in their forehand.');
      input.focus();
    }
  }

  async function setExact(pid) {
    var p = players().filter(function (x) { return x.id === pid; })[0];
    if (!p) return;
    var v = await B.prompt95('Exact score for <b>' + esc(p.emoji + ' ' + p.name) + '</b>:', {
      title: 'SET_SCORE.EXE', icon: '🔢', type: 'number', value: String(score(pid)), yes: 'Set score'
    });
    if (v === null) return;
    var n = Number(v);
    if (!Number.isInteger(n)) {
      B.showDialog({ title: 'SET_SCORE.EXE', icon: '⚠️', body: 'Whole numbers only. This is tennis, not figure skating.' });
      return;
    }
    // finish any queued taps first so they cannot land on top of the exact value
    clearTimeout(S.flushTimer);
    while (S.saving) await new Promise(function (r) { setTimeout(r, 100); });
    delete S.pending[pid];
    await flush();
    await save(function (data) { data.scores = data.scores || {}; data.scores[pid] = n; }, 'SET_SCORE.EXE');
  }

  async function removePlayer(pid) {
    var p = players().filter(function (x) { return x.id === pid; })[0];
    if (!p) return;
    var yes = await B.confirm95('Remove <b>' + esc(p.emoji + ' ' + p.name) + '</b>? Their points go with them.', {
      title: 'Retire player?', icon: '🗑️', yes: 'Retire them', no: 'Keep playing'
    });
    if (!yes) return;
    delete S.pending[pid];
    await save(function (data) {
      data.players = (data.players || []).filter(function (x) { return x.id !== pid; });
      if (data.scores) delete data.scores[pid];
    }, 'Retire player');
  }

  async function finish() {
    await flush();
    var top = leaders();
    if (!top.length) {
      B.showDialog({ title: 'Finish', icon: '⚠️', body: 'There is nobody to crown yet. Add players first.' });
      return;
    }
    var label = names(top);
    var yes = await B.confirm95('Finish this scoreboard and crown <b>' + esc(label) + '</b>' +
      (top.length > 1 ? ' (tied for first)' : '') + '? It goes into the Roll of Champions.', {
      title: 'Crown the champion', icon: '🏆', yes: 'Crown them', no: 'Keep playing'
    });
    if (!yes) return;
    if (await save(function () { return { status: 'finished', winner: label }; }, 'Finish')) {
      S.tab = 'standings';
      render();
      if (B.mascotSay) B.mascotSay('ladies and gentlemen, your champion. please clap politely, this is a lawn.');
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var root = document.getElementById('page-scoreboard');
    if (!root) return;
    B.buildChrome('scoreboard', { subtitle: 'quiet please, scoring in progress' });
    S.id = B.param('id');
    if (!S.id) { location.href = '/'; return; }
    mount(root);

    root.addEventListener('click', function (e) {
      var t = e.target;
      var tabBtn = t.closest('[data-tab]');
      if (tabBtn) { S.tab = tabBtn.getAttribute('data-tab'); render(); return; }
      if (t.closest('#tabulate')) {
        S.tab = 'standings'; render();
        document.getElementById('sb-win').scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (t.closest('#back-to-entry')) { S.tab = 'entry'; render(); return; }
      if (t.closest('#sb-login')) { e.preventDefault(); B.loginDialog(); return; }
      if (t.closest('#emoji-btn')) { S.emojiIdx++; showEmoji(); return; }
      if (t.closest('#sb-finish')) return finish();
      if (t.closest('#sb-reopen')) return save(function () { return { status: 'live', winner: null }; }, 'Reopen');
      if (t.closest('#sb-rename')) {
        return B.prompt95('New name:', { title: 'RENAME.EXE', value: S.ev.title, maxlength: 80 }).then(function (v) {
          if (v && v.trim()) save(function () { return { title: v.trim() }; }, 'Rename');
        });
      }
      if (t.closest('#sb-reset')) {
        return B.confirm95('Reset <b>every</b> score to 0? Players stay.', { title: 'Format C:\\SCORES?', icon: '💣', yes: 'Reset', no: 'Abort mission' })
          .then(function (yes) {
            if (!yes) return;
            S.pending = {};
            save(function (data) { data.scores = {}; }, 'Reset');
          });
      }
      if (t.closest('#sb-delete')) {
        return B.confirm95('Delete <b>' + esc(S.ev.title) + '</b> for good? It also leaves the Roll of Champions.', { title: 'Delete scoreboard', icon: '🗑️', yes: 'Delete it', no: 'Keep it' })
          .then(async function (yes) {
            if (!yes) return;
            try { await B.api('/events/' + S.ev.id, { method: 'DELETE', body: {} }); location.href = '/'; }
            catch (err) { B.showDialog({ title: 'Delete', icon: '❌', body: 'Could not delete: <b>' + esc(err.message) + '</b>' }); }
          });
      }
      var act = t.closest('[data-act]');
      if (!act || !canEdit()) return;
      var pid = act.getAttribute('data-id');
      var kind = act.getAttribute('data-act');
      if (kind === 'plus' || kind === 'minus') {
        S.pending[pid] = (S.pending[pid] || 0) + (kind === 'plus' ? 1 : -1);
        render();
        scheduleFlush();
      } else if (kind === 'set') {
        setExact(pid);
      } else if (kind === 'del') {
        removePlayer(pid);
      }
    });
    document.getElementById('add-form').addEventListener('submit', addPlayer);
    document.addEventListener('blitz:auth', render);

    (async function boot() {
      B.checkUmpire();
      try {
        S.ev = await B.api('/events/' + encodeURIComponent(S.id));
        if (S.ev.kind !== 'scoreboard') { location.replace('/tournament?id=' + S.ev.id); return; }
        setSync('🟢 live');
        render();
      } catch (e) {
        document.getElementById('panel-entry').innerHTML = '<p class="empty-note">Could not load this scoreboard: <b>' + esc(e.message) + '</b><br><a href="/">Back to Centre Court</a></p>';
        return;
      }
      B.watchEvent(S.ev.id, function () { return S.saving ? null : S.ev.version; }, function (ev) {
        if (S.saving) return; // our own save will bring the newest version
        S.ev = ev;
        setSync('🟢 live');
        render();
      }, function (err, n) {
        if (err.status === 404) { setSync('🔴 this scoreboard was deleted'); return; }
        setSync(n > 2 ? '🔴 offline · retrying' : '🟡 reconnecting…');
      });
    })();
  });
})();
