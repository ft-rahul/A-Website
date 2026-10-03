// Accounts and learning data, kept in this browser's localStorage.
// There is no server: every account and its saved state live on this device
// only. Passwords are stored as salted SHA-256 hashes, never as plain text.
import { storage } from './storage';

const USERS = 'users'; // { [email]: { id, email, firstName, lastName, createdAt, salt, hash } }
const CURRENT = 'current_user'; // id of the signed-in account
const dataKey = (id) => `data_${id}`;

export const EMPTY_STATE = { purchasedCourseIds: [], cartCourseIds: [], progress: {}, activity: { days: {}, events: [] }, code: {}, playback: {} };

const randomId = () => {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  }
};

const hex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');

const hashPassword = async (password, salt) => {
  const bytes = new TextEncoder().encode(`${salt}:${password}`);
  return hex(await crypto.subtle.digest('SHA-256', bytes));
};

const publicUser = ({ id, email, firstName, lastName, createdAt }) => ({ id, email, firstName, lastName, createdAt });

const allUsers = () => storage.get(USERS, {}) || {};
const findById = (id) => Object.values(allUsers()).find((u) => u.id === id) || null;

export const findUser = (email) => allUsers()[email] || null;

export const createUser = async ({ email, password, firstName, lastName }) => {
  const users = allUsers();
  const salt = randomId();
  const user = { id: randomId(), email, firstName, lastName, createdAt: new Date().toISOString(), salt, hash: await hashPassword(password, salt) };
  storage.set(USERS, { ...users, [email]: user });
  return publicUser(user);
};

/** Resolves to the public user when the password matches, otherwise null. */
export const checkPassword = async (email, password) => {
  const user = findUser(email);
  if (!user) return null;
  return (await hashPassword(password, user.salt)) === user.hash ? publicUser(user) : null;
};

export const updateUser = (id, fields) => {
  const users = allUsers();
  const entry = Object.entries(users).find(([, u]) => u.id === id);
  if (!entry) return null;
  const next = { ...entry[1], ...fields };
  storage.set(USERS, { ...users, [entry[0]]: next });
  return publicUser(next);
};

export const getCurrentUser = () => {
  const id = storage.get(CURRENT, null);
  const user = id && findById(id);
  return user ? publicUser(user) : null;
};
export const setCurrentUser = (id) => storage.set(CURRENT, id || null);

export const loadState = (id) => ({ ...EMPTY_STATE, ...(storage.get(dataKey(id), null) || {}) });

/** Merges fields into the account's saved state. */
export const saveState = (id, fields) => {
  if (!id) return;
  storage.set(dataKey(id), { ...loadState(id), ...fields });
};

export const clearState = (id) => storage.set(dataKey(id), EMPTY_STATE);
