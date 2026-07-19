/* Blitz 95 — API client. Plain script, no modules (artifact build concatenates these). */
window.Blitz = window.Blitz || { pages: {} };

(function () {
  var KEY_STORAGE = 'blitz_admin_key';

  function getAdminKey() {
    try { return localStorage.getItem(KEY_STORAGE); } catch (e) { return null; }
  }

  function setAdminKey(key) {
    try {
      if (key) localStorage.setItem(KEY_STORAGE, key);
      else localStorage.removeItem(KEY_STORAGE);
    } catch (e) { /* private mode: session-only admin, fine */ }
  }

  /* On admin.html?key=XYZ: stash the key, then scrub it from the URL + history. */
  function captureAdminKeyFromUrl() {
    var params = new URLSearchParams(location.search);
    var key = params.get('key');
    if (key) {
      setAdminKey(key);
      params.delete('key');
      var qs = params.toString();
      history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
    }
    return getAdminKey();
  }

  async function api(path, opts) {
    opts = opts || {};
    var method = opts.method || 'GET';
    var headers = { 'Content-Type': 'application/json' };
    if (method !== 'GET') headers['X-Admin-Key'] = getAdminKey() || '';
    var res = await fetch('/api' + path, {
      method: method,
      headers: headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
    });
    var json;
    try { json = await res.json(); }
    catch (e) { throw new Error('server returned garbage (HTTP ' + res.status + ')'); }
    if (!json.ok) {
      var error = new Error(json.error || 'unknown error');
      error.status = res.status;
      throw error;
    }
    return json.data;
  }

  window.Blitz.api = api;
  window.Blitz.getAdminKey = getAdminKey;
  window.Blitz.setAdminKey = setAdminKey;
  window.Blitz.captureAdminKeyFromUrl = captureAdminKeyFromUrl;
})();
