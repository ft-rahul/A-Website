import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getCourse, courses } from '../data/catalog';
import { storage, removeLegacyKeys, todayKey, setStorageUser } from '../lib/storage';
import { del, post, put } from '../lib/api';
import { resetUserData } from '../lib/userData';
import { pathToRoute, routeToPath } from '../lib/router';
import { useAuth, PUBLIC_ROUTES } from './AuthContext';
import { pickQuote } from '../lib/receipt';

const AppContext = createContext(null);

// New accounts start with nothing; they enrol from the catalogue.
const DEFAULT_OWNED = [];
const MAX_EVENTS = 120;
const enc = encodeURIComponent;
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

export const AppProvider = ({ children }) => {
  const { user, requestLogin, updateName, takeGreeting, takeInitialState } = useAuth();
  // Server state loaded at sign-in. This provider is re-mounted when the user changes.
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
  const toggleTheme = useCallback(() => setTheme((t) => (t === 'light' ? 'dark' : 'light')), []);

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
  // The server records activity; this local copy updates streaks instantly.
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
      post('/cart/items', { courseId: course.id }).catch((err) => {
        if (err.code === 'already-in-cart') return;
        setCartIds((prev) => prev.filter((id) => id !== course.id));
        reportError('Not added to cart', err);
      });
    },
    [user, requestLogin, purchasedCourseIds, cartIds, showToast, reportError]
  );
  const removeFromCart = useCallback((courseId) => {
    setCartIds((prev) => prev.filter((id) => id !== courseId));
    del(`/cart/items/${enc(courseId)}`).catch((err) => {
      setCartIds((prev) => (prev.includes(courseId) ? prev : [...prev, courseId]));
      reportError('Not removed from cart', err);
    });
  }, [reportError]);
  const clearCart = useCallback(() => {
    setCartIds([]);
    del('/cart').catch((err) => reportError('Cart not cleared', err));
  }, [reportError]);

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
      put(`/progress/${enc(courseId)}/lessons/${enc(lessonId)}/complete`).catch((err) => {
        setCourseProgress((prev) => {
          const c = prev[courseId];
          return c ? { ...prev, [courseId]: { ...c, completedLessons: c.completedLessons.filter((id) => id !== lessonId) } } : prev;
        });
        reportError('Progress not saved', err);
      });
      return true;
    },
    [logEvent, reportError]
  );

  const setLastLesson = useCallback((courseId, lessonId) => {
    if (progressRef.current[courseId]?.lastLessonId !== lessonId) {
      put(`/progress/${enc(courseId)}/last-lesson`, { lessonId }).catch(() => { /* only a resume hint */ });
    }
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
      put(`/progress/${enc(courseId)}/lessons/${enc(lessonId)}/notes`, { text }).catch((err) => reportError('Notes not saved', err));
    },
    [logEvent, reportError]
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
      const clean = (marks || []).map((m) => ({
        id: String(m.id),
        kind: m.kind === 'bookmark' ? 'bookmark' : 'note',
        time: typeof m.time === 'number' ? m.time : null,
        text: String(m.text || ''),
        tags: Array.isArray(m.tags) ? m.tags : [],
        ...(m.createdAt ? { createdAt: m.createdAt } : {})
      }));
      put(`/progress/${enc(courseId)}/lessons/${enc(lessonId)}/marks`, { marks: clean }).catch((err) => reportError('Notes not saved', err));
    },
    [logEvent, reportError]
  );

  // ── Checkout & enrollment celebration ─────────────────────
  const [checkoutModal, setCheckoutModal] = useState({ isOpen: false, step: 'verify', items: [], totalPrice: 0, idempotencyKey: '' });
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
      setCheckoutModal({ isOpen: true, step: 'verify', items, totalPrice: items.reduce((s, c) => s + c.price, 0), idempotencyKey: newKey() });
    },
    [user, requestLogin, purchasedCourseIds, showToast]
  );

  const closeCheckoutModal = useCallback(() => {
    setCheckoutModal({ isOpen: false, step: 'verify', items: [], totalPrice: 0, idempotencyKey: '' });
  }, []);

  /**
   * Places the order on the server, which prices it from its own catalogue.
   * Resolves true on success; on failure shows why and resolves false.
   */
  const completePurchase = useCallback(async ({ method = 'card' } = {}) => {
    const { items, idempotencyKey } = checkoutModal;
    let result;
    try {
      result = await post('/orders', { courseIds: items.map((c) => c.id), paymentMethod: method, idempotencyKey });
    } catch (err) {
      if (err.code === 'already-enrolled') {
        showToast('Already enrolled', 'You already have access to these courses.');
        closeCheckoutModal();
      } else {
        reportError('Payment not completed', err);
      }
      return false;
    }
    const { order, enrolledCourseIds } = result;
    const newIds = enrolledCourseIds.filter((id) => !purchasedCourseIds.includes(id));
    const orderedIds = order.items.map((i) => i.courseId);
    setPurchasedCourseIds((prev) => Array.from(new Set([...prev, ...enrolledCourseIds])));
    setCartIds((prev) => prev.filter((id) => !orderedIds.includes(id) && !items.some((c) => c.id === id)));
    newIds.forEach((courseId) => logEvent('enrolled', { courseId }));
    closeCheckoutModal();
    if (newIds.length) {
      const at = new Date(order.createdAt).getTime();
      setCelebration({
        courseIds: newIds,
        at,
        paid: order.total,
        order: order.orderNumber,
        transactionId: order.transactionId,
        method: order.paymentMethodLabel,
        quote: pickQuote(at),
        customer: { name: profile.name, email: profile.email, firstName: profile.firstName }
      });
    }
    return true;
  }, [checkoutModal, purchasedCourseIds, logEvent, closeCheckoutModal, profile, showToast, reportError]);

  const dismissCelebration = useCallback(() => setCelebration(null), []);

  // ── Reset ─────────────────────────────────────────────────
  // Clears only the signed-in account's saved data; the account itself stays.
  const resetAllDemoData = useCallback(async () => {
    try {
      await del('/users/me/learning-data');
    } catch (err) {
      reportError('Data not reset', err);
      return;
    }
    resetUserData();
    setPurchasedCourseIds(DEFAULT_OWNED);
    setCartIds([]);
    setCourseProgress({});
    setActivity({ days: {}, events: [] });
    showToast('Data reset', 'Enrolments, progress and notes were cleared.');
  }, [showToast, reportError]);

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
