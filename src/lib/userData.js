// Saved exercise code and video resume points for the signed-in learner.
// Reads are synchronous from an in-memory copy loaded with the account
// state; writes update it at once and are saved to localStorage.
import { saveState } from './localDb';

let userId = null;
let cache = { code: {}, playback: {} };

export const hydrateUserData = (state, id) => {
  userId = id || null;
  cache = { code: { ...(state?.code || {}) }, playback: { ...(state?.playback || {}) } };
};

/** Forgets the in-memory copy (sign-out or a data reset); saved data is untouched. */
export const resetUserData = () => {
  userId = null;
  cache = { code: {}, playback: {} };
};

const persist = (field) => { if (userId) saveState(userId, { [field]: cache[field] }); };

const codeKey = (courseId, lessonId) => `${courseId}/${lessonId}`;

export const getSavedCode = (courseId, lessonId) => cache.code[codeKey(courseId, lessonId)] || null;

export const saveCode = (courseId, lessonId, files) => {
  const clean = files.map(({ id, name, language, code }) => ({ id: String(id), name: String(name), language: String(language || 'plaintext'), code: String(code ?? '') }));
  cache.code[codeKey(courseId, lessonId)] = clean;
  persist('code');
};

export const clearSavedCode = (courseId, lessonId) => {
  delete cache.code[codeKey(courseId, lessonId)];
  persist('code');
};

export const getPlaybackPositions = () => cache.playback;

/** seconds = null forgets the position (the video was finished). */
export const savePlaybackPosition = (key, seconds) => {
  if (!key) return;
  if (seconds == null) delete cache.playback[key];
  else cache.playback[key] = Math.floor(seconds);
  persist('playback');
};
