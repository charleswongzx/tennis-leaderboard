/* Weembledon '94 - API client + umpire session. Plain script, no modules. */
window.Blitz = window.Blitz || { pages: {} };

(function () {
  var B = window.Blitz;
  var umpire = null; // null = not asked yet

  async function api(path, opts) {
    opts = opts || {};
    var method = opts.method || 'GET';
    var res = await fetch('/api' + path, {
      method: method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
    });
    var json;
    try { json = await res.json(); }
    catch (e) { throw new Error('the server sent back gibberish (HTTP ' + res.status + ')'); }
    if (!json.ok) {
      var error = new Error(json.error || 'unknown error');
      error.status = res.status;
      error.current = json.data;
      if (res.status === 401 && umpire) setUmpire(false);
      throw error;
    }
    return json.data;
  }

  function setUmpire(v) {
    var changed = umpire !== v;
    umpire = v;
    if (changed) document.dispatchEvent(new CustomEvent('blitz:auth', { detail: { umpire: v } }));
  }

  async function checkUmpire() {
    try { setUmpire(!!(await api('/me')).umpire); }
    catch (e) { setUmpire(false); }
    return umpire;
  }

  async function login(password) {
    await api('/login', { method: 'POST', body: { password: password } });
    setUmpire(true);
  }

  async function logout() {
    try { await api('/logout', { method: 'POST', body: {} }); } catch (e) { /* cookie dies anyway */ }
    setUmpire(false);
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /*
   * Save a change to an event without trampling anyone else's.
   * `change(data, event)` edits a copy of event.data in place and may return extra
   * fields ({ status, winner, title }). On a version conflict we reload the latest
   * event and run `change` again on it, so concurrent umpires both land.
   * Resolves with the saved event.
   */
  async function saveEvent(event, change) {
    var current = event;
    for (var attempt = 0; attempt < 5; attempt++) {
      var data = clone(current.data || {});
      var extra = change(data, current) || {};
      var body = Object.assign({ version: current.version, data: data }, extra);
      try {
        return await api('/events/' + current.id, { method: 'PUT', body: body });
      } catch (e) {
        if (e.status === 409 && e.current) { current = e.current; continue; }
        throw e;
      }
    }
    throw new Error('too many umpires shouting at once. try again');
  }

  /* Poll an event; calls onChange(event) whenever its version moves. Returns stop(). */
  function watchEvent(id, getVersion, onChange, onError) {
    var stopped = false, timer = null, failures = 0;
    async function tick() {
      if (stopped) return;
      if (document.visibilityState === 'visible') {
        try {
          var v = getVersion();
          var res = await api('/events/' + id + (v ? '?v=' + v : ''));
          failures = 0;
          if (!res.unchanged) onChange(res);
        } catch (e) {
          failures++;
          if (onError) onError(e, failures);
        }
      }
      timer = setTimeout(tick, failures ? Math.min(30000, 4000 * failures) : 4000);
    }
    timer = setTimeout(tick, 4000);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && !stopped) { clearTimeout(timer); tick(); }
    });
    return function () { stopped = true; clearTimeout(timer); };
  }

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  B.api = api;
  B.isUmpire = function () { return !!umpire; };
  B.checkUmpire = checkUmpire;
  B.login = login;
  B.logout = logout;
  B.saveEvent = saveEvent;
  B.watchEvent = watchEvent;
  B.clone = clone;
  B.today = today;
  B.param = function (name) { return new URLSearchParams(location.search).get(name); };
})();
