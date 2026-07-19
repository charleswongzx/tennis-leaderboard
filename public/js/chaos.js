/* ============================================================
   CHAOS.JS — shared Blitz 95 behaviors.
   Taskbar, ticker, dialogs, mascot, sparkles, bleeps.
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

  /* ---------- bleep engine (WebAudio, muted by default) ---------- */

  var SOUND_KEY = 'blitz95_sound';
  var audioCtx = null;

  function soundOn() {
    try { return localStorage.getItem(SOUND_KEY) === '1'; } catch (e) { return false; }
  }

  function bleep(kind) {
    if (!soundOn()) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      var o = audioCtx.createOscillator();
      var g = audioCtx.createGain();
      o.type = 'square';
      var now = audioCtx.currentTime;
      if (kind === 'error') {
        o.frequency.setValueAtTime(311, now);
        o.frequency.setValueAtTime(233, now + 0.09);
      } else if (kind === 'tada') {
        o.frequency.setValueAtTime(523, now);
        o.frequency.setValueAtTime(784, now + 0.08);
      } else {
        o.frequency.setValueAtTime(660, now);
      }
      g.gain.setValueAtTime(0.04, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
      o.connect(g).connect(audioCtx.destination);
      o.start(now);
      o.stop(now + 0.18);
    } catch (e) { /* the beeps were not meant to be */ }
  }

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
    bleep(opts.icon === '⚠️' || opts.icon === '❌' ? 'error' : 'ok');
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

  var CLOSE_JOKES = [
    'blitz.exe has performed an <b>illegal ace</b> and cannot be shut down.',
    'This window is load-bearing. Removing it would crash the leaderboard, the site, and possibly your racquet.',
    'Error 0x0040LOVE: close request denied. The rally must continue.',
    'You can check out any time you like, but this window can never leave.',
    'Task failed successfully! The window remains open out of spite.'
  ];

  /* ---------- chrome: taskbar, header, ticker, footer ---------- */

  var NAV = [
    { id: 'index', label: '🏆 Leaderboard', href: 'index.html' },
    { id: 'sessions', label: '📅 Sessions', href: 'sessions.html' }
  ];

  function buildChrome(active, opts) {
    opts = opts || {};
    var desktop = document.querySelector('.desktop');
    if (!desktop) return;

    var navItems = NAV.slice();
    if (opts.showAdminTab) navItems.push({ id: 'admin', label: '🔧 Control Panel', href: 'admin.html' });

    var bar = el('<nav class="taskbar" aria-label="Taskbar"></nav>');
    var start = el('<button class="w95-btn start" type="button">🎾 Start</button>');
    start.addEventListener('click', function () {
      showDialog({
        title: 'Start Menu',
        icon: '🎾',
        body: 'Programs:<br>📁 <b>tennis.exe</b> — go outside and play tennis<br>📁 <b>excuses.dll</b> — currently in use by everyone below rank 3<br>📁 <b>hydration_reminder.sys</b> — drink water!!',
        buttons: [{ label: 'Cool' }]
      });
    });
    bar.appendChild(start);
    navItems.forEach(function (n) {
      var a = el('<a class="w95-btn' + (n.id === active ? ' active' : '') + '" data-nav="' + n.id + '" href="' + n.href + '">' + n.label + '</a>');
      bar.appendChild(a);
    });
    bar.appendChild(el('<span class="spacer"></span>'));

    var soundBtn = el('<button class="w95-btn" type="button" title="toggle bleeps" aria-label="Toggle sound">' + (soundOn() ? '🔊' : '🔇') + '</button>');
    soundBtn.addEventListener('click', function () {
      var next = !soundOn();
      try { localStorage.setItem(SOUND_KEY, next ? '1' : '0'); } catch (e) {}
      soundBtn.textContent = next ? '🔊' : '🔇';
      if (next) bleep('tada');
    });
    bar.appendChild(soundBtn);

    var clock = el('<span class="clock">--:--</span>');
    function tick() {
      var d = new Date();
      var h = d.getHours() % 12 || 12;
      var m = String(d.getMinutes()).padStart(2, '0');
      clock.textContent = h + ':' + m + (d.getHours() >= 12 ? ' PM' : ' AM');
    }
    tick();
    setInterval(tick, 20000);
    bar.appendChild(clock);
    desktop.prepend(bar);

    var header = el(
      '<header class="wordart-wrap">' +
        '<h1 class="wordart">🎾 BLITZ LEADERBOARD 95 🎾</h1>' +
        '<p class="wordart-sub">est. whenever · absolutely no prize money · <span class="blink">'
          + esc(opts.subtitle || 'now with 100% more Comic Sans') + '</span></p>' +
      '</header>');
    desktop.insertBefore(header, bar.nextSibling);

    var ticker = el('<div class="ticker" aria-hidden="true"><div class="ticker-inner">*** BOOTING BLITZ 95 ... PLEASE WAIT ... ACQUIRING TENNIS ... ***</div></div>');
    desktop.insertBefore(ticker, header.nextSibling);

    var visitorNo = String(420 + (new Date().getDate() * 7) % 100).padStart(6, '0');
    desktop.appendChild(el(
      '<footer class="retro-footer">' +
        '<span class="construction"><span>🚧 UNDER CONSTRUCTION SINCE 1997 🚧</span></span>' +
        'You are visitor <span class="hit-counter">' + visitorNo + '</span> !!<br>' +
        'Best viewed in 800×600 in Netscape Navigator 3.0 · no cookies were harmed<br>' +
        '<small>© Blitz Tennis Club · all rights reversed</small>' +
      '</footer>'));

    /* titlebar buttons: ✕ = joke error, □ = actually collapses */
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.titlebar-controls button');
      if (!btn || btn.closest('.w95-dialog')) return;
      var win = btn.closest('.win95-window');
      if (btn.dataset.action === 'close') {
        showDialog({
          title: 'System Error',
          icon: '❌',
          body: CLOSE_JOKES[Math.floor(Math.random() * CLOSE_JOKES.length)],
          buttons: [{ label: 'OK' }, { label: 'OK, but louder', onClick: function () { bleep('error'); bleep('error'); } }]
        });
      } else if (btn.dataset.action === 'min' && win) {
        win.classList.toggle('collapsed');
        bleep('ok');
      }
    });

    document.addEventListener('click', function (e) {
      if (e.target.closest('button, a')) bleep('ok');
    });

    initSparkles();
    initMascot();
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

  var TIPS = [
    'did you know? hitting the ball harder makes it go faster.',
    'pro tip: the ball cannot hurt you if you simply are not there.',
    'a "let" is when the net commits a crime and nobody gets punished.',
    'hydrate!! water is just protein shake for the personality.',
    'if you shout "OUT" with enough confidence, the laws of physics will consider it.',
    'losing builds character. some of you are basically Dostoevsky by now.',
    'the sun is a skill issue.',
    'statistically, every ball you don\'t chase was probably out anyway.',
    'doubles is just singles with a witness.',
    'remember: the leaderboard is forever. the shame is also forever.',
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

    var tipIdx = Math.floor(Math.random() * TIPS.length);
    var hideTimer = null;

    function say(text) {
      bubble.querySelector('.bubble-text').textContent = text;
      bubble.classList.remove('hidden');
      clearTimeout(hideTimer);
      hideTimer = setTimeout(function () { bubble.classList.add('hidden'); }, 9000);
    }

    function nextTip() {
      say(TIPS[tipIdx % TIPS.length]);
      tipIdx++;
      bleep('ok');
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

  B.esc = esc;
  B.el = el;
  B.fmtDate = fmtDate;
  B.buildChrome = buildChrome;
  B.setTicker = setTicker;
  B.showDialog = showDialog;
  B.confirm95 = confirm95;
  B.bleep = bleep;
})();
