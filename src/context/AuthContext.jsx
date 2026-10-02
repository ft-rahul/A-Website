import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as auth from '../lib/auth';
import { setSessionEndHandler } from '../lib/api';
import { hydrateUserData, resetUserData } from '../lib/userData';
import { routeToPath } from '../lib/router';

const AuthContext = createContext(null);

// Screens a guest may open. Everything else asks them to log in first.
export const PUBLIC_ROUTES = new Set(['lobby', 'not-found']);

const EMPTY_STATE = { purchasedCourseIds: [], cartCourseIds: [], progress: {}, activity: { days: {}, events: [] }, code: {}, playback: {} };

/**
 * Who is signed in, plus the login dialog.
 * On load the session is restored from the httpOnly refresh cookie. The
 * learner's saved state (enrolments, cart, progress...) is fetched before the
 * app below mounts, so screens never flash empty data. The app is re-mounted
 * per user (see main.jsx).
 */
export const AuthProvider = ({ children }) => {
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready'
  const [user, setUser] = useState(null);
  // { open, mode: 'login' | 'signup', reason, next: { route, params } | null }
  const [prompt, setPrompt] = useState({ open: false, mode: 'login', reason: '', next: null });
  // A message for the freshly mounted app to show once (e.g. "Welcome back").
  const greeting = useRef(null);
  const setGreeting = (g) => { greeting.current = g; };
  // Server state handed to AppProvider when it mounts.
  const initialState = useRef(EMPTY_STATE);

  const adopt = useCallback((u, state) => {
    initialState.current = state || EMPTY_STATE;
    hydrateUserData(state);
    setUser(u);
  }, []);

  // Restore the session once on load.
  useEffect(() => {
    let live = true;
    auth.restoreSession()
      .then((r) => { if (live && r) adopt(r.user, r.state); })
      .catch(() => {
        if (live) setGreeting({ title: 'Offline', message: 'Could not reach Monklogy. Some features are unavailable.', type: 'error' });
      })
      .finally(() => { if (live) setStatus('ready'); });
    return () => { live = false; };
  }, [adopt]);

  const requestLogin = useCallback((next = null, reason = '', mode = 'login') => {
    setPrompt({ open: true, mode, reason, next });
  }, []);
  const requestSignup = useCallback((next = null, reason = '') => {
    setPrompt({ open: true, mode: 'signup', reason, next });
  }, []);
  const closeLogin = useCallback(() => setPrompt((p) => ({ ...p, open: false, next: null })), []);

  // The refresh token expired or was revoked while the app was open.
  useEffect(() => {
    setSessionEndHandler(() => {
      resetUserData();
      initialState.current = EMPTY_STATE;
      setUser((u) => {
        if (u) setGreeting({ title: 'Session ended', message: 'Log in again to continue.', type: 'info' });
        return null;
      });
    });
    return () => setSessionEndHandler(null);
  }, []);

  // After signing in, land on whatever the guest was trying to open.
  const enter = useCallback(
    (u, state, isNew) => {
      const next = prompt.next;
      if (next?.route) window.history.pushState({}, '', routeToPath(next.route, next.params || {}));
      window.scrollTo({ top: 0, behavior: 'auto' });
      setGreeting(isNew ? { title: `Welcome, ${u.firstName}`, message: 'Your account is ready.' } : { title: `Welcome back, ${u.firstName}`, message: '' });
      setPrompt((p) => ({ ...p, open: false, next: null }));
      adopt(u, state);
    },
    [prompt.next, adopt]
  );

  const signIn = useCallback(async (email, password) => {
    const r = await auth.signIn(email, password);
    if (r.ok) enter(r.user, r.state, false);
    return r;
  }, [enter]);

  const signUp = useCallback(async (details) => {
    const r = await auth.signUp(details);
    if (r.ok) enter(r.user, r.state, true);
    return r;
  }, [enter]);

  const signOut = useCallback(async () => {
    await auth.signOut();
    resetUserData();
    initialState.current = EMPTY_STATE;
    window.history.pushState({}, '', routeToPath('lobby'));
    window.scrollTo({ top: 0, behavior: 'auto' });
    setGreeting({ title: 'Signed out', message: 'See you soon.' });
    setUser(null);
  }, []);

  /** Throws on failure so the caller can tell the learner. */
  const updateName = useCallback(async (firstName, lastName) => {
    if (!user) return;
    const u = await auth.updateNames(firstName, lastName);
    if (u) setUser(u);
  }, [user]);

  const takeGreeting = useCallback(() => {
    const g = greeting.current;
    greeting.current = null;
    return g;
  }, []);

  const takeInitialState = useCallback(() => initialState.current, []);

  const value = useMemo(
    () => ({
      status,
      user,
      isGuest: !user,
      prompt,
      requestLogin,
      requestSignup,
      closeLogin,
      signIn,
      signUp,
      signOut,
      updateName,
      accountExists: auth.accountExists,
      takeGreeting,
      takeInitialState
    }),
    [status, user, prompt, requestLogin, requestSignup, closeLogin, signIn, signUp, signOut, updateName, takeGreeting, takeInitialState]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
