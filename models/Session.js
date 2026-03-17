/**
 * models/Session.js
 *
 * Manages authenticated session state.
 * Persists token and user metadata to sessionStorage so it survives page reloads
 * within the same browser tab, matching the app's expected behavior.
 */

const STORAGE_KEY = 'os_session';

/**
 * @typedef {Object} SessionData
 * @property {string|null} token     - X-Parse-Session-Token
 * @property {string|null} userId    - Parse objectId
 * @property {string|null} username
 * @property {string|null} email
 */

/** Live session object — single source of truth for auth state. */
export const session = {
  token:    null,
  userId:   null,
  username: null,
  email:    null,

  /** Restore session from sessionStorage on page load. */
  load() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) Object.assign(this, JSON.parse(raw));
    } catch (_) { /* ignore */ }
  },

  /** Persist current session to sessionStorage. */
  save() {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      token:    this.token,
      userId:   this.userId,
      username: this.username,
      email:    this.email,
    }));
  },

  /** Clear session data and remove from sessionStorage. */
  clear() {
    this.token = null;
    this.userId = null;
    this.username = null;
    this.email = null;
    sessionStorage.removeItem(STORAGE_KEY);
  },

  /** True if a valid session token is present. */
  get isLoggedIn() {
    return !!this.token;
  },
};
