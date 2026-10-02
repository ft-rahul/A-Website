// Saved exercise code and video resume points for the signed-in learner.
// Reads are synchronous from an in-memory copy loaded with the account
// state (GET /api/me/state); writes update it at once and are sent to the
// API in the background, debounced per lesson.
import { del, hasSession, put } from './api';

let cache = { code: {}, playback: {} };
const timers = new Map();
const pending = new Map(); // key -> () => request (so the latest write can be flushed on page hide)

export const hydrateUserData = (state) => {
  cache = { code: { ...(state?.code || {}) }, playback: { ...(state?.playback || {}) } };
};

export const resetUserData = () => {
  timers.forEach(clearTimeout);
  timers.clear();
  pending.clear();
  cache = { code: {}, playback: {} };
};

const schedule = (key, delay, run) => {
  if (!hasSession()) return;
  clearTimeout(timers.get(key));
  pending.set(key, run);
  timers.set(key, setTimeout(() => {
    timers.delete(key);
    pending.delete(key);
    run().catch(() => { /* best effort: the next save sends the latest copy */ });
  }, delay));
};

const codeKey = (courseId, lessonId) => `${courseId}/${lessonId}`;
const path = (courseId, lessonId) => `/workspace/${encodeURIComponent(courseId)}/${encodeURIComponent(lessonId)}`;

export const getSavedCode = (courseId, lessonId) => cache.code[codeKey(courseId, lessonId)] || null;

export const saveCode = (courseId, lessonId, files) => {
  const clean = files.map(({ id, name, language, code }) => ({ id: String(id), name: String(name), language: String(language || 'plaintext'), code: String(code ?? '') }));
  cache.code[codeKey(courseId, lessonId)] = clean;
  schedule(`code:${codeKey(courseId, lessonId)}`, 400, (opts) => put(path(courseId, lessonId), { files: clean }, opts));
};

export const clearSavedCode = (courseId, lessonId) => {
  delete cache.code[codeKey(courseId, lessonId)];
  const key = `code:${codeKey(courseId, lessonId)}`;
  clearTimeout(timers.get(key));
  pending.delete(key);
  if (hasSession()) del(path(courseId, lessonId)).catch(() => {});
};

export const getPlaybackPositions = () => cache.playback;

/** seconds = null forgets the position (the video was finished). */
export const savePlaybackPosition = (key, seconds) => {
  if (!key) return;
  if (seconds == null) delete cache.playback[key];
  else cache.playback[key] = Math.floor(seconds);
  const value = seconds == null ? null : Math.floor(seconds);
  schedule(`play:${key}`, seconds == null ? 0 : 1500, (opts) => put('/playback', { key, seconds: value }, opts));
};

// Send anything still waiting when the tab is hidden or closed.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    pending.forEach((run, key) => {
      clearTimeout(timers.get(key));
      run({ keepalive: true }).catch(() => {});
    });
    timers.clear();
    pending.clear();
  });
}
