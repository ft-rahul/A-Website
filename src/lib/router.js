// URL routing on top of the History API. Every screen has a real address under /monkology.
//   /monkology                                   lobby
//   /monkology/courses                           catalog
//   /monkology/courses/:courseId                 course details
//   /monkology/courses/:courseId/learn/:lessonId tutor
//   /monkology/learn                             tutor (last course)
//   /monkology/mycourses · /cart · /profile
import { getCourse } from '../data/catalog';

// The site's root (import.meta.env.BASE_URL): '/' locally, '/A-Website/' on GitHub Pages.
const ROOT = import.meta.env.BASE_URL.replace(/\/+$/, '');
export const BASE = `${ROOT}/monkology`;

export const routeToPath = (route, p = {}) => {
  switch (route) {
    case 'courses':
      return `${BASE}/courses`;
    case 'course-details':
      return `${BASE}/courses/${p.courseId}`;
    case 'tutor':
      return p.courseId ? `${BASE}/courses/${p.courseId}/learn${p.lessonId ? `/${p.lessonId}` : ''}` : `${BASE}/learn`;
    case 'my-courses':
      return `${BASE}/mycourses`;
    case 'cart':
      return `${BASE}/cart`;
    case 'profile':
      return `${BASE}/profile`;
    case 'not-found':
      return p.path || `${BASE}/not-found`;
    default:
      return BASE;
  }
};

export const pathToRoute = (pathname) => {
  const path = decodeURIComponent(pathname).replace(/\/+$/, '') || '/';
  if (path === '/' || path === '' || path === ROOT) return { route: 'lobby', params: {}, redirect: BASE };
  if (path !== BASE && !path.startsWith(`${BASE}/`)) return { route: 'not-found', params: { path } };
  const seg = path.slice(BASE.length).split('/').filter(Boolean);
  if (!seg.length) return { route: 'lobby', params: {} };
  const [a, b, c, d] = seg;
  if (a === 'courses' && !b) return { route: 'courses', params: {} };
  if (a === 'courses' && b) {
    if (!getCourse(b)) return { route: 'not-found', params: { path } };
    if (!c) return { route: 'course-details', params: { courseId: b } };
    if (c === 'learn') return { route: 'tutor', params: { courseId: b, lessonId: d } };
  }
  if (a === 'learn' && !b) return { route: 'tutor', params: {} };
  if (a === 'mycourses' && !b) return { route: 'my-courses', params: {} };
  if (a === 'cart' && !b) return { route: 'cart', params: {} };
  if (a === 'profile' && !b) return { route: 'profile', params: {} };
  return { route: 'not-found', params: { path } };
};
