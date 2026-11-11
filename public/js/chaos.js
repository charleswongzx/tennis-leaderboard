/* ============================================================
   CHAOS.JS - shared Weembledon '94 behaviors.
   Taskbar (with umpire login), header, ticker, dialogs, mascot,
   sparkles, theme music.
   ============================================================ */
window.Blitz = window.Blitz || { pages: {} };

(function () {
  var B = window.Blitz;

  /* ---------- tiny DOM helpers ---------- */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function el(html) {
    var t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function fmtDate(iso) {
    if (!iso) return '???';
    var p = iso.split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    if (isNaN(d)) return iso;
    return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }

  /* ---------- battle music playlist (off by default, remembered per device) ---------- */

  var MUSIC_KEY = 'weembledon_music';
  var MUSIC_POS_KEY = 'weembledon_music_pos';
  var PLAYLIST = [
    { src: '/audio/theme-8bit.mp3', title: 'Who Wants To Be A Millionaire? - Questions 1 to 5 (8-bit)' },
    { src: '/audio/pokemon-trainer-battle.mp3', title: 'Pokémon Red/Blue/Yellow - Trainer Battle' },
    { src: '/audio/sf2-guile-theme.mp3', title: "Super Street Fighter II - Guile's Theme" },
    { src: '/audio/ff7-those-who-fight-further.mp3', title: 'Final Fantasy VII - Those Who Fight Further' },
    { src: '/audio/undertale-megalovania.mp3', title: 'Undertale - Megalovania' },
    { src: '/audio/honey-money-pooh-drill.mp3', title: 'Honey Money (Winnie the Pooh Drill Parody)' }
  ];
  var audio = null;
  var trackIdx = 0;
  var resumeArmed = false;
  var nowPlaying = null;

  /* the music player, bottom left: previous / play-pause / next and a scrolling title */
  function paintNowPlaying() {
    if (!document.body) return;
    if (!nowPlaying) {
      nowPlaying = el(
        '<div class="now-playing" role="region" aria-label="Music player">' +
          '<span class="np-eq" aria-hidden="true"><i></i><i></i><i></i></span>' +
          '<span class="np-window" aria-live="polite"><span class="np-text"></span></span>' +
          '<span class="np-controls">' +
            '<button type="button" class="np-btn" data-np="prev" title="Previous track" aria-label="Previous track">⏮</button>' +
            '<button type="button" class="np-btn np-play" data-np="play" title="Play" aria-label="Play">▶</button>' +
            '<button type="button" class="np-btn" data-np="next" title="Next track" aria-label="Next track">⏭</button>' +
          '</span>' +
        '</div>');
      nowPlaying.addEventListener('click', function (e) {
        var b = e.target.closest('[data-np]');
        if (!b) return;
        var what = b.getAttribute('data-np');
        if (what === 'play') togglePlay();
        else changeTrack(what === 'next' ? 1 : -1);
      });
      document.body.appendChild(nowPlaying);
    }
    var on = soundOn();
    var playing = !!(audio && !audio.paused);
    var title = (trackIdx + 1) + '/' + PLAYLIST.length + ': ' + PLAYLIST[trackIdx].title;
    nowPlaying.classList.toggle('paused', !playing);
    var playBtn = nowPlaying.querySelector('.np-play');
    playBtn.textContent = on ? '⏸' : '▶';
    playBtn.title = on ? 'Pause' : 'Play';
    playBtn.setAttribute('aria-label', on ? 'Pause' : 'Play');
    var text = playing ? '♪ NOW PLAYING ' + title + ' ♪'
      : on ? '♪ TAP ANYWHERE TO RESUME · ' + title + ' ♪'
      : '♪ PAUSED · ' + title + ' ♪';
    var t = nowPlaying.querySelector('.np-text');
    if (t.getAttribute('data-text') !== text) {
      t.setAttribute('data-text', text);
      t.textContent = text + '   ' + text + '   ';
    }
  }

  function togglePlay() {
    var next = !soundOn();
    try { localStorage.setItem(MUSIC_KEY, next ? '1' : '0'); } catch (e) {}
    if (next) startMusic(); else stopMusic();
  }

  function soundOn() {
    try { return localStorage.getItem(MUSIC_KEY) === '1'; } catch (e) { return false; }
  }

  function loadTrack(i, at) {
    trackIdx = ((i % PLAYLIST.length) + PLAYLIST.length) % PLAYLIST.length;
    audio.src = PLAYLIST[trackIdx].src;
    if (at > 0) {
      audio.addEventListener('loadedmetadata', function seek() {
        audio.removeEventListener('loadedmetadata', seek);
        try { audio.currentTime = at; } catch (e) {}
      });
    }
  }

  function getAudio() {
    if (!audio) {
      audio = new Audio();
      audio.preload = 'none';
      audio.volume = 0.5;
      audio.addEventListener('playing', paintNowPlaying);
      audio.addEventListener('pause', paintNowPlaying);
      audio.addEventListener('ended', function () { changeTrack(1); });
      // carry on with the same song, from the same spot, when moving between pages
      var saved = { i: 0, t: 0 };
      try { saved = JSON.parse(sessionStorage.getItem(MUSIC_POS_KEY)) || saved; } catch (e) {}
      loadTrack(Number(saved.i) || 0, Number(saved.t) || 0);
    }
    return audio;
  }

  function changeTrack(step) {
    getAudio();
    loadTrack(trackIdx + step, 0);
    if (soundOn()) startMusic(); else paintNowPlaying();
  }

  // Browsers only allow sound after the visitor interacts with the page, so if
  // music was left on, start it on the first tap or key press.
  function armResume() {
    if (resumeArmed) return;
    resumeArmed = true;
    function go(e) {
      if (e && e.target && e.target.closest && e.target.closest('.now-playing')) return; // the player's own buttons handle it
      document.removeEventListener('pointerdown', go, true);
      document.removeEventListener('keydown', go, true);
      resumeArmed = false;
      if (soundOn()) startMusic();
    }
    document.addEventListener('pointerdown', go, true);
    document.addEventListener('keydown', go, true);
  }

  function startMusic() {
    var played = getAudio().play();
    if (played && played.catch) played.catch(armResume);
    paintNowPlaying();
  }

  function stopMusic() {
    if (audio) audio.pause();
    paintNowPlaying();
  }

  window.addEventListener('pagehide', function () {
    try {
      if (audio) sessionStorage.setItem(MUSIC_POS_KEY, JSON.stringify({ i: trackIdx, t: audio.currentTime || 0 }));
    } catch (e) {}
  });

  /* ---------- dialogs ---------- */

  function showDialog(opts) {
    var overlay = el(
      '<div class="w95-dialog-overlay">' +
        '<div class="w95-dialog" role="dialog" aria-modal="true">' +
          '<div class="titlebar"><span class="titlebar-text">' + esc(opts.title || 'blitz.exe') + '</span>' +
            '<span class="titlebar-controls"><button data-dialog-close aria-label="Close">✕</button></span></div>' +
          '<div class="dialog-body">' +
            '<div class="dialog-icon">' + (opts.icon || '⚠️') + '</div>' +
            '<div class="dialog-text">' + opts.body + '</div>' +
          '</div>' +
          '<div class="dialog-buttons"></div>' +
        '</div>' +
      '</div>');
    var btnRow = overlay.querySelector('.dialog-buttons');
    var buttons = opts.buttons && opts.buttons.length ? opts.buttons : [{ label: 'OK' }];
    buttons.forEach(function (b) {
      var btn = el('<button' + (b.primary ? ' class="primary"' : '') + '>' + esc(b.label) + '</button>');
      btn.addEventListener('click', function () {
        if (b.onClick) b.onClick();
        close();
      });
      btnRow.appendChild(btn);
    });
    var closed = false;
    function close() {
      if (closed) return;
      closed = true;
      overlay.remove();
      if (opts.onClose) opts.onClose();
    }
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay || e.target.hasAttribute('data-dialog-close')) close();
    });
    document.body.appendChild(overlay);
    var first = btnRow.querySelector('button');
    if (first) first.focus();
    return { close: close };
  }

  /* confirm() but make it Win95. Returns a promise<boolean>; overlay/✕ close counts as "no". */
  function confirm95(bodyHtml, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var answer = false;
      showDialog({
        title: opts.title || 'Are you sure about that?',
        icon: opts.icon || '❓',
        body: bodyHtml,
        buttons: [
          { label: opts.yes || 'Yes, do it', primary: true, onClick: function () { answer = true; } },
          { label: opts.no || 'Abort mission' }
        ],
        onClose: function () { resolve(answer); }
      });
    });
  }

  /* prompt() but make it Win95. Resolves with the typed string, or null on cancel. */
  function prompt95(bodyHtml, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var answer = null;
      var id = 'p95-' + Math.random().toString(36).slice(2);
      var dlg = showDialog({
        title: opts.title || 'Input required',
        icon: opts.icon || '✏️',
        body: '<form id="' + id + '-f" autocomplete="off"><label for="' + id + '" style="margin-top:0">' + bodyHtml + '</label>' +
          '<input id="' + id + '" type="' + (opts.type || 'text') + '" value="' + esc(opts.value || '') + '"' +
          (opts.maxlength ? ' maxlength="' + opts.maxlength + '"' : '') +
          (opts.placeholder ? ' placeholder="' + esc(opts.placeholder) + '"' : '') +
          ' style="width:100%"></form>',
        buttons: [
          { label: opts.yes || 'OK', primary: true, onClick: function () { answer = document.getElementById(id).value; } },
          { label: opts.no || 'Cancel' }
        ],
        onClose: function () { resolve(answer); }
      });
      var input = document.getElementById(id);
      input.focus();
      input.select();
      document.getElementById(id + '-f').addEventListener('submit', function (e) {
        e.preventDefault();
        answer = input.value;
        dlg.close();
      });
    });
  }

  /* Ask for the umpire password. Resolves true when logged in. */
  async function loginDialog() {
    var tries = 0;
    while (tries < 3) {
      var pw = await prompt95('Umpires only. Enter the password to edit scores and start events:', {
        title: 'UMPIRE_LOGIN.EXE', icon: '🔐', type: 'password', yes: 'Take the chair', no: 'Just watching'
      });
      if (pw === null) return false;
      try {
        await B.login(pw);
        if (B.mascotSay) B.mascotSay('welcome to the umpire chair. please do not overrule the line judges for fun.');
        return true;
      } catch (e) {
        tries++;
        if (e.status !== 401) {
          showDialog({ title: 'UMPIRE_LOGIN.EXE', icon: '❌', body: 'Could not log in: <b>' + esc(e.message) + '</b>' });
          return false;
        }
        if (tries >= 3) {
          showDialog({ title: 'Hawk-Eye says no', icon: '🦅', body: 'Three challenges used, all overturned. That password is <b>out</b>.' });
          return false;
        }
      }
    }
    return false;
  }

  var CLOSE_JOKES = [
    'weembledon.exe has performed an <b>illegal ace</b> and cannot be shut down.',
    'This window is load-bearing. Removing it would crash the Championships, the site, and possibly your racquet.',
    'Quiet please. Windows may not be closed during a point.',
    'Error 0x0040LOVE: close request denied. The rally must continue.',
    'You can check out any time you like, but this window can never leave.',
    'Task failed successfully! The window remains open out of spite.'
  ];

  /* ---------- chrome: taskbar, header, ticker, footer ---------- */

  function buildChrome(active, opts) {
    opts = opts || {};
    var desktop = document.querySelector('.desktop');
    if (!desktop) return;

    var bar = el('<nav class="taskbar" aria-label="Taskbar"></nav>');
    var start = el('<button class="w95-btn start" type="button">🎾 Start</button>');
    start.addEventListener('click', function () {
      showDialog({
        title: 'Start Menu',
        icon: '🍓',
        body: 'Programs:<br>📁 <b>tennis.exe</b> - go outside and play tennis<br>📁 <b>strawberries_and_cream.exe</b> - mandatory between sets<br>📁 <b>excuses.dll</b> - currently in use by everyone below rank 3<br>📁 <b>hydration_reminder.sys</b> - drink water!!',
        buttons: [{ label: 'Cool' }]
      });
    });
    bar.appendChild(start);
    bar.appendChild(el('<a class="w95-btn' + (active === 'home' ? ' active' : '') + '" href="/">🏠 Centre Court</a>'));
    bar.appendChild(el('<span class="spacer"></span>'));

    var umpBtn = el('<button class="w95-btn umpire-btn" type="button"></button>');
    function paintUmpire() {
      var on = B.isUmpire();
      umpBtn.textContent = on ? '🧑‍⚖️ Umpire' : '🔒 Umpire login';
      umpBtn.title = on ? 'You can edit. Click to log out.' : 'Log in to edit scores and start events';
      umpBtn.classList.toggle('active', on);
      document.body.classList.toggle('is-umpire', on);
    }
    umpBtn.addEventListener('click', async function () {
      if (B.isUmpire()) {
        var out = await confirm95('Leave the umpire chair on this device? You can still watch everything.', {
          title: 'Log out', icon: '🧑‍⚖️', yes: 'Log out', no: 'Stay'
        });
        if (out) await B.logout();
      } else {
        await loginDialog();
      }
    });
    document.addEventListener('blitz:auth', paintUmpire);
    paintUmpire();
    bar.appendChild(umpBtn);


    var clock = el('<span class="clock" title="Official timekeeper: Rolax">⌚ --:--</span>');
    function tick() {
      var d = new Date();
      var h = d.getHours() % 12 || 12;
      var m = String(d.getMinutes()).padStart(2, '0');
      clock.textContent = '⌚ ROLAX ' + h + ':' + m + (d.getHours() >= 12 ? ' PM' : ' AM');
    }
    tick();
    setInterval(tick, 20000);
    bar.appendChild(clock);
    desktop.prepend(bar);

    var header = el(
      '<header class="wordart-wrap">' +
        '<p class="crest" aria-hidden="true">🎾 🍓 🎾</p>' +
        '<div class="wordart-group">' +
          '<h1 class="wordart"><span class="wa-small">ROLAX</span> WEEMBLEDON<br>CHAMPIONSHIPS \'94</h1>' +
          '<p class="wordart-sub">Powered by <b>Blitz Academy</b> · all-weather lawn simulator · <span class="blink">'
            + esc(opts.subtitle || 'quiet please') + '</span></p>' +
        '</div>' +
      '</header>');
    desktop.insertBefore(header, bar.nextSibling);

    var ticker = el('<div class="ticker" aria-hidden="true"><div class="ticker-inner">*** WELCOME TO THE ROLAX WEEMBLEDON CHAMPIONSHIPS \'94 ... MOWING THE LAWN ... PLEASE WAIT ***</div></div>');
    desktop.insertBefore(ticker, header.nextSibling);

    var visitorNo = String(420 + (new Date().getDate() * 7) % 100).padStart(6, '0');
    desktop.appendChild(el(
      '<footer class="retro-footer">' +
        '<span class="construction"><span>🍓 STRAWBERRIES &amp; CREAM SERVED SINCE 1994 🍓</span></span>' +
        'You are spectator <span class="hit-counter">' + visitorNo + '</span> !!<br>' +
        'Best viewed in 800×600 in Netscape Navigator 3.0 · predominantly white attire required<br>' +
        '<small>Rolax Weembledon is a Blitz Academy production. Not affiliated with any real watch or real lawn. All rights reversed.</small>' +
      '</footer>'));

    /* titlebar buttons: ✕ = joke error, ▁ = actually collapses */
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.titlebar-controls button');
      if (!btn || btn.closest('.w95-dialog')) return;
      var win = btn.closest('.win95-window');
      if (btn.dataset.action === 'close') {
        showDialog({
          title: 'System Error',
          icon: '❌',
          body: CLOSE_JOKES[Math.floor(Math.random() * CLOSE_JOKES.length)],
          buttons: [{ label: 'OK' }, { label: 'OK, but louder' }]
        });
      } else if (btn.dataset.action === 'min' && win) {
        win.classList.toggle('collapsed');
      }
    });

    initSparkles();
    initMascot();
    getAudio();
    paintNowPlaying();
    if (soundOn()) startMusic();
  }

  /* A Win95 window as an HTML string. */
  function win(title, bodyHtml, attrs, statusHtml) {
    return '<section class="win95-window" ' + (attrs || '') + '>' +
      '<div class="titlebar"><span class="titlebar-text">' + title + '</span>' +
      '<span class="titlebar-controls"><button type="button" data-action="min" aria-label="Minimize">▁</button>' +
      '<button type="button" data-action="close" aria-label="Close">✕</button></span></div>' +
      '<div class="win95-body">' + bodyHtml + '</div>' +
      (statusHtml ? '<div class="statusbar">' + statusHtml + '</div>' : '') +
      '</section>';
  }

  function setTicker(messages) {
    var inner = document.querySelector('.ticker-inner');
    if (!inner || !messages || !messages.length) return;
    var text = '*** ' + messages.join(' *** ') + ' *** ';
    inner.textContent = text + text; /* doubled so the loop never runs dry */
    var secs = Math.max(18, Math.min(90, Math.round(text.length / 5)));
    inner.style.setProperty('--ticker-secs', secs + 's');
  }

  /* ---------- Blitzy the mascot ---------- */

  // Blitzy always opens with these two, in this order; the tips below follow.
  var OPENERS = [
    'this place smells like 2026',
    'on what planet does piglet tying knots look like a constricted pikachu'
  ];

  var TIPS = [
    'did you know? hitting the ball harder makes it go faster.',
    'the strawberries are for after the match. put them down.',
    'predominantly white attire. your socks count. i am watching your socks.',
    'the grass is not slippery. you are just bad at standing.',
    'pro tip: the ball cannot hurt you if you simply are not there.',
    'a "let" is when the net commits a crime and nobody gets punished.',
    'hydrate!! water is just protein shake for the personality.',
    'if you shout "OUT" with enough confidence, the laws of physics will consider it.',
    'losing builds character. some of you are basically Dostoevsky by now.',
    'the sun is a skill issue.',
    'statistically, every ball you don\'t chase was probably out anyway.',
    'doubles is just singles with a witness.',
    'remember: the roll of champions is forever. the shame is also forever.',
    'top spin? bottom spin? i am a ball, everything spins for me.',
    'an ace a day keeps the friendship away.'
  ];

  function initMascot() {
    var mascot = el(
      '<div class="mascot" role="button" tabindex="0" aria-label="Blitzy the tennis ball. Click for wisdom.">' +
        '<div class="ball"></div>' +
        '<div class="eye left"></div><div class="eye right"></div>' +
        '<div class="mouth"></div>' +
      '</div>');
    var bubble = el('<div class="speech-bubble hidden"><span class="bubble-title">Blitzy says:</span><span class="bubble-text"></span></div>');
    document.body.appendChild(bubble);
    document.body.appendChild(mascot);

    var lines = OPENERS.concat(TIPS.slice().sort(function () { return Math.random() - 0.5; }));
    var tipIdx = 0;
    var hideTimer = null;

    function say(text) {
      bubble.querySelector('.bubble-text').textContent = text;
      bubble.classList.remove('hidden');
      clearTimeout(hideTimer);
      hideTimer = setTimeout(function () { bubble.classList.add('hidden'); }, 9000);
    }

    function nextTip() {
      say(lines[tipIdx % lines.length]);
      tipIdx++;
    }

    mascot.addEventListener('click', nextTip);
    mascot.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nextTip(); }
    });

    setTimeout(nextTip, 2500);
    B.mascotSay = say;
  }

  /* ---------- sparkle trail ---------- */

  function initSparkles() {
    var last = 0;
    var GLYPHS = ['✨', '⭐', '🎾', '✳️'];
    document.addEventListener('pointermove', function (e) {
      var now = Date.now();
      if (now - last < 120) return;
      last = now;
      var s = document.createElement('span');
      s.className = 'sparkle';
      s.textContent = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      s.style.left = (e.clientX + 6) + 'px';
      s.style.top = (e.clientY + 6) + 'px';
      document.body.appendChild(s);
      setTimeout(function () { s.remove(); }, 750);
    }, { passive: true });
  }

  /* ---------- exports ---------- */

  var EMOJIS = ['🎾', '🦖', '🐐', '🔥', '🥑', '🐙', '🦄', '🍌', '🐸', '👽', '🤖', '🦀', '🐝', '🌶️', '🧀', '🚀', '🦩', '🐧', '💅', '🥷', '🍓', '🦆', '🐢', '🌵'];

  B.EMOJIS = EMOJIS;
  B.newId = function (prefix) { return (prefix || 'p') + Math.random().toString(36).slice(2, 8); };
  B.esc = esc;
  B.el = el;
  B.fmtDate = fmtDate;
  B.buildChrome = buildChrome;
  B.setTicker = setTicker;
  B.showDialog = showDialog;
  B.confirm95 = confirm95;
  B.prompt95 = prompt95;
  B.loginDialog = loginDialog;
  B.win = win;
})();
