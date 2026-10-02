import { todayKey } from './storage';
import { courses, getCurriculum, summarizeProgress } from '../data/catalog';

/** Consecutive days with activity, ending today (or yesterday if today has none yet). */
export const computeStreak = (days = {}) => {
  const d = new Date();
  if (!days[todayKey(d)]) d.setDate(d.getDate() - 1);
  let streak = 0;
  while (days[todayKey(d)]) {
    streak += 1;
    d.setDate(d.getDate() - 1);
  }
  return streak;
};

export const longestStreak = (days = {}) => {
  const keys = Object.keys(days).sort();
  let best = 0;
  let run = 0;
  let prev = null;
  keys.forEach((k) => {
    const cur = new Date(`${k}T00:00:00`);
    if (prev && (cur - prev) / 86400000 === 1) run += 1;
    else run = 1;
    best = Math.max(best, run);
    prev = cur;
  });
  return best;
};

export const RANKS = [
  { name: 'Novice', at: 0 },
  { name: 'Initiate', at: 3 },
  { name: 'Practitioner', at: 10 },
  { name: 'Adept', at: 25 },
  { name: 'Master', at: 50 }
];

export const rankFor = (lessonsCompleted) => {
  let idx = 0;
  RANKS.forEach((r, i) => {
    if (lessonsCompleted >= r.at) idx = i;
  });
  const current = RANKS[idx];
  const next = RANKS[idx + 1] || null;
  const span = next ? next.at - current.at : 1;
  const into = next ? lessonsCompleted - current.at : 1;
  return { current, next, toNext: next ? next.at - lessonsCompleted : 0, fraction: Math.min(1, into / span), index: idx };
};

/** Everything the profile and My Courses need, derived from stored state. */
export const learnerStats = ({ purchasedCourseIds, courseProgress, activity }) => {
  const owned = courses.filter((c) => purchasedCourseIds.includes(c.id));
  const perCourse = owned.map((c) => ({ course: c, ...summarizeProgress(c.id, courseProgress[c.id]) }));
  const lessonsCompleted = perCourse.reduce((s, p) => s + p.completed, 0);
  const totalLessons = perCourse.reduce((s, p) => s + p.total, 0);
  const coursesCompleted = perCourse.filter((p) => p.total && p.completed >= p.total).length;
  const notes = owned.flatMap((c) => {
    const entry = courseProgress[c.id] || {};
    const ids = new Set([...Object.keys(entry.notes || {}), ...Object.keys(entry.marks || {})]);
    return [...ids].map((lessonId) => {
      const page = (entry.notes?.[lessonId] || '').trim();
      const marks = entry.marks?.[lessonId] || [];
      const firstText = marks.find((m) => m.text)?.text || '';
      return {
        course: c,
        lesson: getCurriculum(c.id).lessons.find((l) => l.id === lessonId),
        text: page || firstText || (marks.length ? `${marks.length} bookmark${marks.length > 1 ? 's' : ''}` : ''),
        marks: marks.length
      };
    });
  }).filter((n) => n.lesson && n.text);
  const bookmarks = owned.reduce((sum, c) => sum + Object.values(courseProgress[c.id]?.marks || {}).flat().filter((m) => m.kind === 'bookmark').length, 0);

  // Skill level: share of completed lessons across owned courses that teach the skill.
  const skillMap = {};
  perCourse.forEach((p) => {
    p.course.skills.forEach((s) => {
      skillMap[s] ||= { name: s, done: 0, total: 0, courses: [] };
      skillMap[s].done += p.completed;
      skillMap[s].total += p.total;
      skillMap[s].courses.push(p.course.title);
    });
  });
  const skills = Object.values(skillMap)
    .map((s) => ({ ...s, level: s.total ? s.done / s.total : 0 }))
    .sort((a, b) => b.level - a.level || b.total - a.total);

  const activeDays = Object.keys(activity.days || {}).length;
  return {
    owned,
    perCourse,
    lessonsCompleted,
    totalLessons,
    coursesCompleted,
    notes,
    bookmarks,
    skills,
    streak: computeStreak(activity.days),
    longest: longestStreak(activity.days),
    activeDays,
    rank: rankFor(lessonsCompleted)
  };
};

/** Achievements are computed from real state; nothing is awarded by default. */
export const achievements = (s, activity) => {
  const enrolledEvents = (activity.events || []).filter((e) => e.type === 'enrolled').length;
  return [
    { id: 'first-step', title: 'First step', hint: 'Complete your first lesson.', done: s.lessonsCompleted >= 1 },
    { id: 'note-taker', title: 'In your own words', hint: 'Write notes on a lesson.', done: s.notes.length >= 1 },
    { id: 'bookmarker', title: 'Mark the moment', hint: 'Bookmark a moment in a lesson video.', done: s.bookmarks >= 1 },
    { id: 'three-days', title: 'Three days running', hint: 'Learn on three consecutive days.', done: s.longest >= 3 },
    { id: 'ten-lessons', title: 'Ten lessons deep', hint: 'Complete ten lessons.', done: s.lessonsCompleted >= 10 },
    { id: 'collector', title: 'Wide curiosity', hint: 'Enrol in a course yourself.', done: enrolledEvents >= 1 },
    { id: 'polyglot', title: 'Polyglot', hint: 'Make progress in three different courses.', done: s.perCourse.filter((p) => p.completed > 0).length >= 3 },
    { id: 'finisher', title: 'Finisher', hint: 'Complete every lesson in a course.', done: s.coursesCompleted >= 1 },
    { id: 'week', title: 'A full week', hint: 'Learn on seven consecutive days.', done: s.longest >= 7 }
  ];
};
