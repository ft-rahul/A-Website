// HTTP client for the Monklogy API.
//
// Tokens:
//  • The access token (15 min JWT) lives only in this module's memory, never
//    in localStorage, so injected scripts cannot read it from storage.
//  • The refresh token is an httpOnly, SameSite=Strict cookie scoped to
//    /api/auth. JavaScript never sees it; the browser sends it to /refresh.
// A 401 triggers one silent refresh (shared by concurrent callers) and a retry.
import { todayKey } from './storage';

const BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');
const CSRF = { 'X-Requested-With': 'monklogy' };
const EARLY_REFRESH_MS = 30_000;

let access = null; // { token, expiresAt }
let refreshing = null;
let onSessionEnd = () => {};

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message || 'Request failed');
    this.status = status;
    this.code = code || 'error';
    this.details = details;
  }
}

export const setSessionEndHandler = (fn) => { onSessionEnd = fn || (() => {}); };
export const hasSession = () => Boolean(access);

/** Stores the access token from a login/register/refresh response. */
export const setAccess = (data) => {
  access = data?.accessToken ? { token: data.accessToken, expiresAt: Date.now() + (data.expiresIn || 900) * 1000 } : null;
};
export const clearAccess = () => { access = null; };

const headers = (extra = {}, withAuth = true) => ({
  ...CSRF,
  'X-Local-Date': todayKey(),
  ...(withAuth && access ? { Authorization: `Bearer ${access.token}` } : {}),
  ...extra
});

const parse = async (res) => {
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

const send = async (path, { method = 'GET', body, auth = true, keepalive = false, signal } = {}) => {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'include',
      headers: headers(body !== undefined ? { 'Content-Type': 'application/json' } : {}, auth),
      body: body !== undefined ? JSON.stringify(body) : undefined,
      keepalive,
      signal
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new ApiError(0, 'network', 'Could not reach Monklogy. Check your connection and try again.');
  }
  const data = await parse(res);
  if (!res.ok) throw new ApiError(res.status, data?.code, data?.message, data?.details);
  return data;
};

/**
 * Exchanges the refresh cookie for a new access token. Concurrent callers
 * share one request. Resolves to the session ({ user, accessToken, ... }) or
 * null when there is no valid session.
 */
export const refreshSession = () => {
  if (!refreshing) {
    refreshing = send('/auth/refresh', { method: 'POST', auth: false })
      .then((data) => { setAccess(data); return data; })
      .catch((err) => {
        if (err.status === 401 || err.status === 403) { clearAccess(); return null; }
        throw err;
      })
      .finally(() => { refreshing = null; });
  }
  return refreshing;
};

const ensureFresh = async () => {
  if (access && access.expiresAt - Date.now() > EARLY_REFRESH_MS) return true;
  return Boolean(await refreshSession());
};

/** Authenticated request with one transparent refresh-and-retry on 401. */
export const api = async (path, opts = {}) => {
  if (opts.auth === false) return send(path, opts);
  if (!(await ensureFresh())) {
    onSessionEnd();
    throw new ApiError(401, 'unauthorized', 'Your session has ended. Log in again.');
  }
  try {
    return await send(path, opts);
  } catch (err) {
    if (err.status !== 401) throw err;
    if (!(await refreshSession())) {
      onSessionEnd();
      throw err;
    }
    return send(path, opts);
  }
};

/** Raw authenticated fetch for streaming responses (server-sent events). */
export const streamRequest = async (path, body, signal) => {
  if (!(await ensureFresh())) {
    onSessionEnd();
    throw new ApiError(401, 'unauthorized', 'Your session has ended. Log in again.');
  }
  const go = () => fetch(`${BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: headers({ 'Content-Type': 'application/json', Accept: 'text/event-stream' }),
    body: JSON.stringify(body),
    signal
  });
  let res = await go();
  if (res.status === 401 && (await refreshSession())) res = await go();
  if (!res.ok) {
    const data = await parse(res);
    throw new ApiError(res.status, data?.code, data?.message);
  }
  return res;
};

export const get = (path, opts) => api(path, { ...opts, method: 'GET' });
export const post = (path, body, opts) => api(path, { ...opts, method: 'POST', body });
export const put = (path, body, opts) => api(path, { ...opts, method: 'PUT', body });
export const patch = (path, body, opts) => api(path, { ...opts, method: 'PATCH', body });
export const del = (path, opts) => api(path, { ...opts, method: 'DELETE' });
