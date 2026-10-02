import React, { Suspense, lazy, useEffect } from 'react';
import { useApp } from './context/AppContext';
import { useAuth, PUBLIC_ROUTES } from './context/AuthContext';
import { AuthModal } from './components/AuthModal';
import { getCourse } from './data/catalog';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { ToastContainer } from './components/ToastContainer';
import { CheckoutModal } from './components/CheckoutModal';
import { EnrollmentCelebration } from './components/EnrollmentCelebration';
import { Lobby } from './pages/Lobby';
import { CoursesPage } from './pages/CoursesPage';
import { CourseDetails } from './pages/CourseDetails';
import { MyCourses } from './pages/MyCourses';
import { CartPage } from './pages/CartPage';

// Heavier, less-visited screens load on demand.
const TutorWorkspace = lazy(() => import('./pages/TutorWorkspace').then((m) => ({ default: m.TutorWorkspace })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));

const NotFound = ({ path, onHome }) => (
  <div className="page">
    <div className="container empty">
      <p className="eyebrow is-accent">404</p>
      <h1>Nothing lives at this address</h1>
      <p className="mono">{path}</p>
      <button className="btn btn-primary" onClick={onHome}>Go to Monklogy</button>
    </div>
  </div>
);

// A guest opened a members-only address directly: explain and offer to log in.
const SignInGate = ({ route, params, onHome }) => {
  const { requestLogin, requestSignup } = useAuth();
  const ask = () => requestLogin({ route, params });
  useEffect(() => {
    ask();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);
  return (
    <div className="page">
      <div className="container empty gate">
        <p className="eyebrow is-accent">Members only</p>
        <h1>Log in to continue</h1>
        <p>Courses, your learning space and your profile open once you are signed in.</p>
        <div className="gate-actions">
          <button className="btn btn-accent" onClick={ask}>Log in</button>
          <button className="btn btn-secondary" onClick={() => requestSignup({ route, params })}>Create an account</button>
          <button className="btn btn-ghost" onClick={onHome}>Back to home</button>
        </div>
      </div>
    </div>
  );
};

const PageFallback = () => <div className="page-loading" role="status" aria-label="Loading" />;

const TITLES = {
  lobby: 'Monklogy — Learn what your code actually does',
  courses: 'Courses — Monklogy',
  'my-courses': 'My courses — Monklogy',
  tutor: 'Tutor — Monklogy',
  cart: 'Cart — Monklogy',
  profile: 'Profile — Monklogy',
  'not-found': 'Not found — Monklogy'
};

export const App = () => {
  const { currentRoute, routeParams, navigateTo } = useApp();
  const { user } = useAuth();
  const locked = !user && !PUBLIC_ROUTES.has(currentRoute);
  const isTutor = currentRoute === 'tutor' && !locked;

  useEffect(() => {
    const course = getCourse(routeParams.courseId);
    document.title =
      currentRoute === 'course-details' && course ? `${course.title} — Monklogy` : TITLES[currentRoute] || 'Monklogy';
  }, [currentRoute, routeParams.courseId]);

  return (
    <div className="app-root">
      <a href="#main-content" className="skip-link">Skip to content</a>
      {!isTutor && <Navbar />}

      {isTutor ? (
        <Suspense fallback={<PageFallback />}>
          <TutorWorkspace />
        </Suspense>
      ) : (
        <main id="main-content" className="app-main" tabIndex={-1}>
          {locked ? (
            <SignInGate route={currentRoute} params={routeParams} onHome={() => navigateTo('lobby')} />
          ) : (
          <>
          {currentRoute === 'lobby' && <Lobby />}
          {currentRoute === 'courses' && <CoursesPage />}
          {currentRoute === 'course-details' && <CourseDetails key={routeParams.courseId} />}
          {currentRoute === 'my-courses' && <MyCourses />}
          {currentRoute === 'cart' && <CartPage />}
          {currentRoute === 'not-found' && <NotFound path={routeParams.path || window.location.pathname} onHome={() => navigateTo('lobby')} />}
          {currentRoute === 'profile' && (
            <Suspense fallback={<PageFallback />}>
              <ProfilePage />
            </Suspense>
          )}
          </>
          )}
        </main>
      )}

      {!isTutor && <Footer />}
      <AuthModal />
      <CheckoutModal />
      <EnrollmentCelebration />
      <ToastContainer />
    </div>
  );
};
