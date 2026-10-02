import { fullstack } from './courses/fullstack';
import { frontend } from './courses/frontend';
import { devops } from './courses/devops';
import { java } from './courses/java';
import { javascript } from './courses/javascript';
import { react } from './courses/react';
import { nodejs } from './courses/nodejs';
import { databases } from './courses/databases';
import { git } from './courses/git';
import { linux } from './courses/linux';
import { getCourseVideos, matchCourseVideos } from '../lib/videoLibrary';

/** Ordered as the catalog presents them: the four core tracks first. */
export const courses = [fullstack, frontend, java, devops, javascript, react, nodejs, databases, git, linux];

const byId = Object.fromEntries(courses.map((c) => [c.id, c]));

export const CATEGORY_ORDER = ['Full-Stack', 'Frontend', 'Backend', 'DevOps', 'Languages', 'Tools'];

export const getCourse = (id) => byId[id] || null;
export const fullTitle = (course) => (course ? `${course.title} — ${course.subtitle}` : '');

const curriculumCache = new Map();

/**
 * The course's modules with every lesson enriched with:
 *  - number: 1-based position in the course
 *  - video: the real file matched from src/Assets/<assetFolder>/ (or null)
 * Videos come from src/assets/courses/<course-id>/<NN-section>/ (see README there).
 */
export const getCurriculum = (courseId) => {
  if (curriculumCache.has(courseId)) return curriculumCache.get(courseId);
  const course = getCourse(courseId);
  if (!course) return { modules: [], lessons: [], videoCount: 0 };

  const { byLesson, extras, total } = matchCourseVideos(course.modules, getCourseVideos(course.id));

  const modules = course.modules.map((m) => ({
    ...m,
    lessons: m.lessons.map((l) => ({ ...l, video: byLesson[l.id] || null }))
  }));

  if (extras.length) {
    modules.push({
      id: `${course.id}-more-videos`,
      title: 'More videos',
      lessons: extras.map((video, i) => ({
        id: `${course.id}-video-${i + 1}`,
        title: video.title,
        duration: '',
        summary: `Video lesson from ${video.relativePath}.`,
        sectionKey: video.section || 'extra',
        video,
        generated: true
      }))
    });
  }

  let n = 0;
  modules.forEach((m) => m.lessons.forEach((l) => { l.number = ++n; l.moduleTitle = m.title; }));

  const result = {
    modules,
    lessons: modules.flatMap((m) => m.lessons),
    videoCount: total
  };
  curriculumCache.set(courseId, result);
  return result;
};

export const getLessonCount = (courseId) => getCurriculum(courseId).lessons.length;

export const findLesson = (courseId, lessonId) =>
  getCurriculum(courseId).lessons.find((l) => l.id === lessonId) || null;

/** Progress summary for a course, derived from stored progress. */
export const summarizeProgress = (courseId, progressEntry) => {
  const { lessons } = getCurriculum(courseId);
  const completedSet = new Set(progressEntry?.completedLessons || []);
  const completed = lessons.filter((l) => completedSet.has(l.id)).length;
  const total = lessons.length;
  const percent = total ? Math.round((completed / total) * 100) : 0;

  let current = null;
  const last = lessons.find((l) => l.id === progressEntry?.lastLessonId);
  if (last && !completedSet.has(last.id)) current = last;
  if (!current) {
    const startIdx = last ? lessons.indexOf(last) : 0;
    current =
      lessons.slice(startIdx).find((l) => !completedSet.has(l.id)) ||
      lessons.find((l) => !completedSet.has(l.id)) ||
      lessons[0] ||
      null;
  }

  const status = completed === 0 ? (progressEntry?.lastLessonId ? 'In progress' : 'Not started')
    : completed >= total ? 'Completed' : 'In progress';

  return { completed, total, percent, current, status };
};

export const formatHours = (h) => `${h} hours`;
export const formatPrice = (p) => `$${p}`;
