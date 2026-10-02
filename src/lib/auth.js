// Account calls. Accounts live on the Monklogy API (see ../monklogy-backend);
// passwords are hashed there with argon2id and never stored in this browser.
import { ApiError, clearAccess, get, patch, post, refreshSession, setAccess } from './api';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const MIN_PASSWORD = 8;

const normalise = (email) => String(email || '').trim().toLowerCase();

const failure = (err, fallback) => ({
  ok: false,
  code: err instanceof ApiError ? err.code : 'error',
  error: (err instanceof ApiError && err.details?.[0]) || err?.message || fallback
});

/** Whether an account exists for this email. Throws on network errors. */
export const accountExists = async (email) => {
  const r = await post('/auth/email-status', { email: normalise(email) }, { auth: false });
  return Boolean(r?.exists);
};

/** Everything the app shows for a signed-in learner, in one request. */
export const loadState = () => get('/me/state');

// The first restore is shared, so React StrictMode's double effects and
// parallel callers do not rotate the refresh cookie twice.
let restoring = null;
/** Resumes the session from the refresh cookie. Resolves to { user, state } or null. */
export const restoreSession = () => {
  if (!restoring) {
    restoring = (async () => {
      const session = await refreshSession();
      if (!session) return null;
      const state = await loadState();
      return { user: state.user, state };
    })().finally(() => { setTimeout(() => { restoring = null; }, 0); });
  }
  return restoring;
};

const startSession = async (data) => {
  setAccess(data);
  const state = await loadState();
  return { ok: true, user: state.user, state };
};

export const signIn = async (email, password) => {
  try {
    return await startSession(await post('/auth/login', { email: normalise(email), password }, { auth: false }));
  } catch (err) {
    return failure(err, 'Could not log in. Try again.');
  }
};

export const signUp = async ({ email, password, firstName, lastName }) => {
  try {
    return await startSession(await post('/auth/register', {
      email: normalise(email),
      password,
      firstName: firstName.trim(),
      lastName: lastName.trim()
    }, { auth: false }));
  } catch (err) {
    return failure(err, 'Could not create your account. Try again.');
  }
};

export const updateNames = async (firstName, lastName) => {
  const r = await patch('/users/me', { firstName: firstName.trim().slice(0, 30), lastName: lastName.trim().slice(0, 30) });
  return r.user;
};

export const signOut = async () => {
  try {
    await post('/auth/logout', undefined, { auth: false });
  } catch {
    /* the local session ends either way */
  } finally {
    clearAccess();
  }
};
