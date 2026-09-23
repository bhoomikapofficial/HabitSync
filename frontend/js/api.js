/**
 * HabitSync API client.
 * A thin wrapper around fetch() that attaches the JWT, points at the
 * right base URL, and normalizes error handling across every page.
 */
const API = (() => {
  // The frontend is served by the same Express app (see server.js static
  // + fallback routes), so relative /api paths always work. If someone
  // opens the HTML files directly (file://) or from a separate static
  // host, they can still point this at the deployed API origin.
  const BASE_URL = window.HABITSYNC_API_BASE || '/api';

  const TOKEN_KEY = 'habitsync_token';
  const USER_KEY = 'habitsync_user';

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
    } catch {
      return null;
    }
  }

  function isLoggedIn() {
    return Boolean(getToken());
  }

  /**
   * Redirects to the login page if there is no session. Call this at the
   * top of every authenticated page's init script.
   */
  function requireAuth() {
    if (!isLoggedIn()) {
      window.location.href = 'index.html';
    }
  }

  async function request(path, { method = 'GET', body, params } = {}) {
    let url = `${BASE_URL}${path}`;

    if (params) {
      const query = new URLSearchParams(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
      ).toString();
      if (query) url += `?${query}`;
    }

    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    let response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (networkErr) {
      throw new Error('Could not reach the HabitSync server. Please check your connection.');
    }

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      // No JSON body (e.g. 204) - leave payload null
    }

    if (response.status === 401) {
      clearSession();
      if (!window.location.pathname.endsWith('index.html') && window.location.pathname !== '/') {
        window.location.href = 'index.html';
      }
    }

    if (!response.ok) {
      const message = (payload && payload.message) || `Request failed with status ${response.status}`;
      const err = new Error(message);
      err.status = response.status;
      err.errors = payload && payload.errors;
      throw err;
    }

    return payload;
  }

  return {
    get: (path, params) => request(path, { method: 'GET', params }),
    post: (path, body) => request(path, { method: 'POST', body }),
    put: (path, body) => request(path, { method: 'PUT', body }),
    del: (path) => request(path, { method: 'DELETE' }),
    getToken,
    setSession,
    clearSession,
    getUser,
    isLoggedIn,
    requireAuth,
  };
})();
