/**
 * models/Session.js
 *
 * Uses localStorage so the session is shared across all tabs
 * and survives page refreshes. Session is valid for 6 months.
 */

const STORAGE_KEY   = 'os_session';
const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;

export const session = {
  token:     null,
  userId:    null,
  username:  null,
  email:     null,
  // Profile fields cached so nav avatar renders instantly on any page refresh
  alias:     null,
  biography: null,
  imageUrl:  null,

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.expiresAt && Date.now() > data.expiresAt) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      Object.assign(this, {
        token:     data.token,
        userId:    data.userId,
        username:  data.username,
        email:     data.email,
        alias:     data.alias     ?? null,
        biography: data.biography ?? null,
        imageUrl:  data.imageUrl  ?? null,
      });
    } catch (_) {}
  },

  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      token:     this.token,
      userId:    this.userId,
      username:  this.username,
      email:     this.email,
      alias:     this.alias,
      biography: this.biography,
      imageUrl:  this.imageUrl,
      expiresAt: Date.now() + SIX_MONTHS_MS,
    }));
  },

  clear() {
    this.token = null; this.userId = null;
    this.username = null; this.email = null;
    this.alias = null; this.biography = null; this.imageUrl = null;
    localStorage.removeItem(STORAGE_KEY);
  },

  get isLoggedIn() { return !!this.token; },
};
