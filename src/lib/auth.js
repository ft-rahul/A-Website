// Account calls. Accounts live in this browser's localStorage (see localDb.js).
import * as db from './localDb';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const MIN_PASSWORD = 8;

const normalise = (email) => String(email || '').trim().toLowerCase();

const failure = (code, error) => ({ ok: false, code, error });

const startSession = (user) => {
  db.setCurrentUser(user.id);
  return { ok: true, user, state: db.loadState(user.id) };
};

/** Whether an account exists for this email. */
export const accountExists = async (email) => Boolean(db.findUser(normalise(email)));

/** Resumes the saved session. Resolves to { user, state } or null. */
export const restoreSession = async () => {
  const user = db.getCurrentUser();
  return user ? { user, state: db.loadState(user.id) } : null;
};

export const signIn = async (email, password) => {
  const key = normalise(email);
  if (!db.findUser(key)) return failure('no-account', 'You don’t have an account on Monklogy yet. Sign up first to continue.');
  try {
    const user = await db.checkPassword(key, password);
    if (!user) return failure('invalid-credentials', 'That password is not right. Try again.');
    return startSession(user);
  } catch {
    return failure('error', 'Could not log in. Try again.');
  }
};

export const signUp = async ({ email, password, firstName, lastName }) => {
  const key = normalise(email);
  if (db.findUser(key)) return failure('exists', 'An account with this email already exists. Log in instead.');
  try {
    return startSession(await db.createUser({ email: key, password, firstName: firstName.trim(), lastName: lastName.trim() }));
  } catch {
    return failure('error', 'Could not create your account. Try again.');
  }
};

export const updateNames = async (id, firstName, lastName) =>
  db.updateUser(id, { firstName: firstName.trim().slice(0, 30), lastName: lastName.trim().slice(0, 30) });

export const signOut = async () => {
  db.setCurrentUser(null);
};
