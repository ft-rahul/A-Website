// Safe localStorage helpers. Storage can throw (private mode, blocked
// site data), so every access is guarded and falls back to a default.
// Everything the site saves lives here: device preferences, accounts and
// learning data (see localDb.js).

const PREFIX = 'monklogy_';

// The signed-in account. AppProvider sets it; account-scoped helpers use it.
let currentUserId = null;
export const setStorageUser = (id) => { currentUserId = id || null; };
const accountKey = (key) => `a_${currentUserId || 'guest'}_${key}`; // kept on reset (settings, keys)

export const storage = {
  get(key, fallback) {
    try {
      const raw = window.localStorage.getItem(PREFIX + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      /* storage unavailable: state still works for this session */
    }
  },
  getRaw(key) {
    try {
      return window.localStorage.getItem(PREFIX + key);
    } catch {
      return null;
    }
  },
  setRaw(key, value) {
    try {
      window.localStorage.setItem(PREFIX + key, value);
    } catch {
      /* ignore */
    }
  },
  /** Account settings that survive a learning-data reset (e.g. the Assistant API key). */
  getAccount(key, fallback) { return storage.get(accountKey(key), fallback); },
  setAccount(key, value) { storage.set(accountKey(key), value); },
  clearAll() {
    try {
      Object.keys(window.localStorage)
        .filter((k) => k.startsWith(PREFIX))
        .forEach((k) => window.localStorage.removeItem(k));
    } catch {
      /* ignore */
    }
  }
};

// Keys written by the previous (pre-Monklogy) build. Removed once so they
// don't linger in the learner's browser.
export const removeLegacyKeys = () => {
  try {
    [
      'artisan_theme', 'artisan_cart', 'artisan_purchased_courses', 'artisan_progress',
      // Pre-account builds kept learning data and the Assistant key browser-wide.
      // Each account now has its own copy, so the shared leftovers are removed.
      'monklogy_profile', 'monklogy_purchased', 'monklogy_cart', 'monklogy_progress', 'monklogy_activity',
      'monklogy_code', 'monklogy_playback', 'monklogy_anthropic_api_key',
      // Browser-only accounts from before the API existed (salted hashes) and their session.
      'monklogy_accounts', 'monklogy_session'
    ].forEach((k) => window.localStorage.removeItem(k));
    // Per-account learning data that used to be kept in this browser ("u_<id>_...").
    Object.keys(window.localStorage)
      .filter((k) => k.startsWith(`${PREFIX}u_`))
      .forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
};

export const todayKey = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
