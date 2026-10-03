import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { getCourse, courses } from '../data/catalog';
import { storage, removeLegacyKeys, todayKey, setStorageUser } from '../lib/storage';
import { clearState, EMPTY_STATE, saveState } from '../lib/localDb';
import { hydrateUserData } from '../lib/userData';
import { pathToRoute, routeToPath } from '../lib/router';
import { useAuth, PUBLIC_ROUTES } from './AuthContext';
import { pickQuote } from '../lib/receipt';

const AppContext = createContext(null);

// New accounts start with nothing; they enrol from the catalogue.
const DEFAULT_OWNED = [];
const MAX_EVENTS = 120;
const newKey = () => {
  try {
    return crypto.randomUUID().replace(/-/g, '');
  } catch {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  }
};

const systemTheme = () => {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
};

const validIds = (ids) => (Array.isArray(ids) ? ids.filter((id) => getCourse(id)) : []);

const PAYMENT_METHODS = { card: 'Credit / debit card', upi: 'UPI', netbanking: 'Net banking', wallet: 'Wallet' };
const ALPHABET = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const randomCode = (n) => Array.from({ length: n }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');

export const AppProvider = ({ children }) => {
  const { user, requestLogin, updateName, takeGreeting, takeInitialState } = useAuth();
  // Saved state loaded at sign-in. This provider is re-mounted when the user changes.
  const initialData = useMemo(() => (user ? takeInitialState() : null), [user, takeInitialState]);
  setStorageUser(user?.id);
  useEffect(() => {
    removeLegacyKeys();
  }, []);

  // ── Site theme ────────────────────────────────────────────
  const [theme, setTheme] = useState(() => storage.getRaw('theme') || systemTheme());
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    storage.setRaw('theme', theme);
  }, [theme]);
  // Switching theme: a circle of the new theme grows out from the button that was
  // clicked and covers the page. Browsers without View Transitions get a cross-fade.
  const toggleTheme = useCallback((e) => {
    const root = document.documentElement;
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    const apply = () => {
      root.setAttribute('data-theme', next);
      flushSync(() => setTheme(next));
    };
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return apply();

    if (!document.startViewTransition) {
      root.classList.add('theme-fading');
      apply();
      window.setTimeout(() => root.classList.remove('theme-fading'), 500);
      return undefined;
    }

    const btn = e?.currentTarget?.getBoundingClientRect?.();
    const x = btn ? btn.left + btn.width / 2 : window.innerWidth - 40;
    const y = btn ? btn.top + btn.height / 2 : 30;
    const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    root.classList.add('theme-switching');
    const vt = document.startViewTransition(apply);
    vt.ready
      .then(() => {
        root.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
          { duration: 650, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', pseudoElement: '::view-transition-new(root)' }
        );
      })
      .catch(() => {});
    vt.finished.finally(() => root.classList.remove('theme-switching'));
    return undefined;
  }, []);

  // Theme customization (palettes / fonts) was removed: clear anything an
  // earlier version saved so every learner gets the Monklogy look.
  useEffect(() => {
    try {
      ['monklogy_palette', 'monklogy_fonts'].forEach((k) => window.localStorage.removeItem(k));
    } catch { /* storage unavailable */ }
    document.documentElement.removeAttribute('data-palette');
  }, []);

  // ── Tutor theme (independent of the site theme) ───────────
  const [tutorTheme, setTutorTheme] = useState(() => storage.getRaw('tutor_theme') || storage.getRaw('theme') || systemTheme());
  useEffect(() => storage.setRaw('tutor_theme', tutorTheme), [tutorTheme]);

  // ── Routing (History API, real addresses under /monkology) ─
  const initial = useMemo(() => {
    const r = pathToRoute(window.location.pathname);
    if (r.redirect) window.history.replaceState({}, '', r.redirect + window.location.search);
    return r;
  }, []);
  const [currentRoute, setCurrentRoute] = useState(initial.route);
  const [routeParams, setRouteParams] = useState(initial.params);

  useEffect(() => {
    const onPop = () => {
      const r = pathToRoute(window.location.pathname);
      setCurrentRoute(r.route);
      setRouteParams(r.params);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigateTo = useCallback((route, params = {}, { replace = false, scroll = true } = {}) => {
    const safe = params || {};
    if (!user && !PUBLIC_ROUTES.has(route)) {
      requestLogin({ route, params: safe });
      return;
    }
    const path = routeToPath(route, safe);
    if (path !== window.location.pathname) {
      window.history[replace ? 'replaceState' : 'pushState']({}, '', path);
    }
    setCurrentRoute(route);
    setRouteParams(safe);
    if (scroll) window.scrollTo({ top: 0, behavior: 'auto' });
  }, [user, requestLogin]);

  // ── Profile (comes from the signed-in account) ────────────
  const profile = useMemo(
    () =>
      user
        ? {
            name: `${user.firstName} ${user.lastName}`.trim(),
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            joinedAt: user.createdAt
          }
        : { name: 'Guest', firstName: 'Guest', lastName: '', email: '', joinedAt: null },
    [user]
  );
  // Toasts are declared below; a ref lets earlier callbacks report failures.
  const toastRef = useRef(() => {});
  const reportError = useCallback((title, err) => {
    if (err?.status === 401) return; // the session ended: AuthContext already handles it
    toastRef.current(title, err?.message || 'Please try again.', 'error');
  }, []);

  const updateProfileName = useCallback(
    async (name) => {
      const [first, ...rest] = name.trim().split(/\s+/);
      if (!first) return false;
      try {
        await updateName(first, rest.join(' ') || first);
        return true;
      } catch (err) {
        reportError('Name not saved', err);
        return false;
      }
    },
    [updateName, reportError]
  );

  // ── Activity log (drives streaks, heatmap, journey) ───────
  const [activity, setActivity] = useState(() => initialData?.activity || { days: {}, events: [] });
  const logEvent = useCallback((type, data = {}) => {
    const at = new Date().toISOString();
    const day = todayKey();
    setActivity((a) => ({
      days: { ...a.days, [day]: (a.days[day] || 0) + 1 },
      events: [{ type, at, ...data }, ...a.events].slice(0, MAX_EVENTS)
    }));
  }, []);

  // ── Toasts ────────────────────────────────────────────────
  const [toasts, setToasts] = useState([]);
  const showToast = useCallback((title, message = '', type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);
  toastRef.current = showToast;
  const removeToast = useCallback((id) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);
  // Greet once after signing in or out (this provider was just re-mounted)
  useEffect(() => {
    const g = takeGreeting();
    if (g) showToast(g.title, g.message, g.type || 'success');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Ownership ─────────────────────────────────────────────
  const [purchasedCourseIds, setPurchasedCourseIds] = useState(() => validIds(initialData?.purchasedCourseIds || DEFAULT_OWNED));
  const isOwned = useCallback((courseId) => purchasedCourseIds.includes(courseId), [purchasedCourseIds]);

  // ── Cart (stores ids only) ────────────────────────────────
  const [cartIds, setCartIds] = useState(() => validIds(initialData?.cartCourseIds || []));
  const cart = useMemo(() => cartIds.map(getCourse).filter(Boolean), [cartIds]);

  const addToCart = useCallback(
    (course) => {
      if (!user) {
        requestLogin({ route: 'course-details', params: { courseId: course.id } }, 'Log in to add courses to your cart.');
        return;
      }
      if (purchasedCourseIds.includes(course.id)) {
        showToast('Already enrolled', `You already have access to ${course.title}.`);
        return;
      }
      if (cartIds.includes(course.id)) {
        showToast('Already in your cart', course.title);
        return;
      }
      setCartIds((prev) => [...prev, course.id]);
      showToast('Added to cart', course.title, 'success');
    },
    [user, requestLogin, purchasedCourseIds, cartIds, showToast]
  );
  const removeFromCart = useCallback((courseId) => {
    setCartIds((prev) => prev.filter((id) => id !== courseId));
  }, []);
  const clearCart = useCallback(() => setCartIds([]), []);

  // ── Progress & notes ──────────────────────────────────────
  const [courseProgress, setCourseProgress] = useState(() => initialData?.progress || {});

  // Ref mirrors state so callbacks can check "was this already done?" synchronously.
  const progressRef = useRef(courseProgress);
  progressRef.current = courseProgress;

  const markLessonCompleted = useCallback(
    (courseId, lessonId) => {
      const entry = progressRef.current[courseId];
      if (entry?.completedLessons?.includes(lessonId)) return false;
      setCourseProgress((prev) => {
        const c = prev[courseId] || { completedLessons: [], notes: {} };
        if (c.completedLessons.includes(lessonId)) return prev;
        return { ...prev, [courseId]: { ...c, completedLessons: [...c.completedLessons, lessonId] } };
      });
      logEvent('lesson_completed', { courseId, lessonId });
      return true;
    },
    [logEvent]
  );

  const setLastLesson = useCallback((courseId, lessonId) => {
    setCourseProgress((prev) => {
      const c = prev[courseId] || { completedLessons: [], notes: {} };
      if (c.lastLessonId === lessonId) return prev;
      return { ...prev, [courseId]: { ...c, lastLessonId: lessonId, lastVisitedAt: new Date().toISOString() } };
    });
  }, []);

  const saveLessonNotes = useCallback(
    (courseId, lessonId, text) => {
      const previous = progressRef.current[courseId]?.notes?.[lessonId];
      setCourseProgress((prev) => {
        const c = prev[courseId] || { completedLessons: [], notes: {} };
        return { ...prev, [courseId]: { ...c, notes: { ...c.notes, [lessonId]: text } } };
      });
      if (previous === undefined && text.trim()) logEvent('note_created', { courseId, lessonId });
    },
    [logEvent]
  );

  // Timestamped notes and bookmarks ("keyframes") per lesson
  const saveLessonMarks = useCallback(
    (courseId, lessonId, marks, added) => {
      setCourseProgress((prev) => {
        const c = prev[courseId] || { completedLessons: [], notes: {} };
        return { ...prev, [courseId]: { ...c, marks: { ...(c.marks || {}), [lessonId]: marks } } };
      });
      if (added === 'note') logEvent('note_created', { courseId, lessonId });
      if (added === 'bookmark') logEvent('bookmark_added', { courseId, lessonId });
    },
    [logEvent]
  );

  // ── Checkout & enrollment celebration ─────────────────────
  const [checkoutModal, setCheckoutModal] = useState({ isOpen: false, items: [], totalPrice: 0, idempotencyKey: '' });
  const [celebration, setCelebration] = useState(null); // { courseIds: [...] } — only for new enrolments

  const startPurchaseFlow = useCallback(
    (itemsToPurchase) => {
      if (!user) {
        const first = Array.isArray(itemsToPurchase) ? itemsToPurchase[0] : itemsToPurchase;
        requestLogin(first ? { route: 'course-details', params: { courseId: first.id } } : null, 'Log in to buy a course.');
        return;
      }
      const items = (Array.isArray(itemsToPurchase) ? itemsToPurchase : [itemsToPurchase]).filter(
        (c) => c && !purchasedCourseIds.includes(c.id)
      );
      if (!items.length) {
        showToast('Already enrolled', 'You already have access to these courses.');
        return;
      }
      // One key per checkout: a retried or double-clicked payment creates one order.
      setCheckoutModal({ isOpen: true, items, totalPrice: items.reduce((s, c) => s + c.price, 0), idempotencyKey: newKey() });
    },
    [user, requestLogin, purchasedCourseIds, showToast]
  );

  const closeCheckoutModal = useCallback(() => {
    setCheckoutModal({ isOpen: false, items: [], totalPrice: 0, idempotencyKey: '' });
  }, []);

  /**
   * Places the order locally (prototype checkout: no payment is taken).
   * Resolves true on success.
   */
  const completePurchase = useCallback(async ({ method = 'card' } = {}) => {
    const { items } = checkoutModal;
    const buying = items.filter((c) => !purchasedCourseIds.includes(c.id));
    if (!buying.length) {
      showToast('Already enrolled', 'You already have access to these courses.');
      closeCheckoutModal();
      return false;
    }
    const at = Date.now();
    const newIds = buying.map((c) => c.id);
    setPurchasedCourseIds((prev) => Array.from(new Set([...prev, ...newIds])));
    setCartIds((prev) => prev.filter((id) => !items.some((c) => c.id === id)));
    newIds.forEach((courseId) => logEvent('enrolled', { courseId }));
    closeCheckoutModal();
    setCelebration({
      courseIds: newIds,
      at,
      paid: buying.reduce((s, c) => s + c.price, 0),
      order: `MNK-${at.toString(36).toUpperCase().slice(-6)}${randomCode(3)}`,
      transactionId: `TXN${at.toString().slice(-8)}${randomCode(8)}`,
      method: PAYMENT_METHODS[method] || method,
      quote: pickQuote(at),
      customer: { name: profile.name, email: profile.email, firstName: profile.firstName }
    });
    return true;
  }, [checkoutModal, purchasedCourseIds, logEvent, closeCheckoutModal, profile, showToast]);

  const dismissCelebration = useCallback(() => setCelebration(null), []);

  // ── Reset ─────────────────────────────────────────────────
  // Clears only the signed-in account's saved data; the account itself stays.
  const resetAllDemoData = useCallback(async () => {
    if (!user) return;
    clearState(user.id);
    hydrateUserData(EMPTY_STATE, user.id);
    setPurchasedCourseIds(DEFAULT_OWNED);
    setCartIds([]);
    setCourseProgress({});
    setActivity({ days: {}, events: [] });
    showToast('Data reset', 'Enrolments, progress and notes were cleared.');
  }, [user, showToast]);

  // ── Save to this browser ──────────────────────────────────
  useEffect(() => {
    if (user) saveState(user.id, { purchasedCourseIds, cartCourseIds: cartIds, progress: courseProgress, activity });
  }, [user, purchasedCourseIds, cartIds, courseProgress, activity]);

  const value = {
    user,
    isGuest: !user,
    requestLogin,
    theme,
    setTheme,
    toggleTheme,
    tutorTheme,
    setTutorTheme,
    currentRoute,
    routeParams,
    navigateTo,
    profile,
    updateProfileName,
    activity,
    cart,
    addToCart,
    removeFromCart,
    clearCart,
    purchasedCourseIds,
    isOwned,
    courseProgress,
    markLessonCompleted,
    setLastLesson,
    saveLessonNotes,
    saveLessonMarks,
    toasts,
    showToast,
    removeToast,
    checkoutModal,
    setCheckoutModal,
    startPurchaseFlow,
    completePurchase,
    closeCheckoutModal,
    celebration,
    dismissCelebration,
    resetAllDemoData,
    allCourses: courses
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => useContext(AppContext);
