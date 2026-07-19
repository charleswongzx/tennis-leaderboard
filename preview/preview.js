/* Blitz 95 — PREVIEW shell: hash router + nav interception.
   In production each page is its own HTML file; here one page plays all three. */
(function () {
  var B = window.Blitz;
  var root, currentRoute = '';

  function parseHash() {
    var h = (location.hash || '#/').replace(/^#\/?/, '');
    if (h.indexOf('session/') === 0) return { page: 'session', id: Number(h.slice(8)) };
    if (h === 'sessions') return { page: 'sessions' };
    if (h === 'admin') return { page: 'admin' };
    return { page: 'index' };
  }

  function setActiveTab(page) {
    document.querySelectorAll('.taskbar [data-nav]').forEach(function (a) {
      var id = a.dataset.nav;
      var on = (page === 'index' && id === 'index') ||
               ((page === 'sessions' || page === 'session') && id === 'sessions') ||
               (page === 'admin' && id === 'admin');
      a.classList.toggle('active', on);
    });
  }

  function route() {
    var r = parseHash();
    var key = r.page + (r.id || '');
    if (key === currentRoute) return;
    currentRoute = key;
    setActiveTab(r.page);
    if (r.page === 'sessions') B.pages.sessions.mount(root, {});
    else if (r.page === 'session') B.pages.sessions.mount(root, { sessionId: r.id });
    else if (r.page === 'admin') B.pages.admin.mount(root);
    else B.pages.leaderboard.mount(root);
    window.scrollTo(0, 0);
  }

  document.addEventListener('DOMContentLoaded', function () {
    root = document.getElementById('page-root');
    B.buildChrome('index', { subtitle: 'PREVIEW BUILD — data is pretend', showAdminTab: true });

    /* preview notice window */
    var notice = B.el(
      '<section class="win95-window">' +
        '<div class="titlebar"><span class="titlebar-text">💾 README_FIRST.TXT</span>' +
        '<span class="titlebar-controls"><button data-action="min" aria-label="Minimize">▁</button></span></div>' +
        '<div class="win95-body" style="font-size:13px">' +
          '🧪 <b>This is the interactive design preview.</b> Everything works — including the ' +
          '<b>🔧 Control Panel</b> — but the data is fake and lives only in this browser. ' +
          'The real thing deploys to Cloudflare with a shared database + hidden admin URL. ' +
          '<div class="btn-row"><button id="preview-reset">🔄 Reset demo data</button></div>' +
        '</div>' +
      '</section>');
    document.querySelector('.desktop').insertBefore(notice, root);
    notice.querySelector('#preview-reset').addEventListener('click', function () {
      B.resetPreviewDb();
      currentRoute = '';
      route();
      B.showDialog({ title: 'time_machine.exe', icon: '🔄', body: 'Demo data restored to factory settings. It is 2026-07-12 again. Volley Llama never got those 99 points.' });
    });

    /* intercept all internal navigation and translate to hash routes */
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href]');
      if (a) {
        var href = a.getAttribute('href');
        if (/^index\.html/.test(href)) { e.preventDefault(); location.hash = '#/'; return; }
        if (/^sessions\.html\?id=(\d+)/.test(href)) { e.preventDefault(); location.hash = '#/session/' + href.match(/id=(\d+)/)[1]; return; }
        if (/^sessions\.html/.test(href)) { e.preventDefault(); location.hash = '#/sessions'; return; }
        if (/^admin\.html/.test(href)) { e.preventDefault(); location.hash = '#/admin'; return; }
      }
      var row = e.target.closest('[data-nav-session], [data-session-id]');
      if (row && !e.target.closest('button')) {
        location.hash = '#/session/' + (row.dataset.navSession || row.dataset.sessionId);
      }
    });

    window.addEventListener('hashchange', route);
    route();
  });
})();
