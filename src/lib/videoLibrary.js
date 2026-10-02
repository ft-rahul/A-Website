/*
 * Course video discovery.
 *
 *   src/assets/courses/<course-id>/<NN-section-name>/<NN - lesson>.mp4
 *
 * Vite scans the folder at build time; only URL strings are imported, so a
 * video downloads only when its lesson is opened. Section folders are matched
 * to course modules by their number prefix (01 → first module). Inside a
 * section, files are matched to that section's lessons in natural filename
 * order. Files placed directly in the course folder fill any lessons still
 * without a video. Extras are never hidden — they become additional lessons.
 * See src/assets/courses/README.md.
 */

const discovered = import.meta.glob(
  '/src/assets/courses/*/**/*.{mp4,MP4,webm,WEBM,m4v,M4V,mov,MOV,ogv,OGV}',
  { eager: true, query: '?url', import: 'default' }
);

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const MIME = { mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', ogv: 'video/ogg' };

export const titleFromFilename = (fileName) => {
  const base = fileName.replace(/\.[^.]+$/, '');
  const cleaned = base
    .replace(/\s*\[[^\]]*\]\s*$/, '')
    .replace(/^\s*(lesson|lecture|part|ep|episode)?\s*[-_.]?\s*\d+\s*[-_.)\]:]*\s*/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const text = cleaned || base;
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export const sectionNumber = (folder) => {
  const m = String(folder || '').match(/^(\d+)/);
  return m ? Number(m[1]) : null;
};

/** { [courseId]: { sections: { [folder]: Video[] }, loose: Video[] } } */
export const buildVideoIndex = (globResult) => {
  const index = {};
  Object.entries(globResult).forEach(([path, url]) => {
    const m = path.match(/\/courses\/([^/]+)\/(.+)$/);
    if (!m) return;
    const [, courseId, rest] = m;
    const parts = rest.split('/');
    const fileName = parts[parts.length - 1];
    const section = parts.length > 1 ? parts[0] : null;
    const ext = (fileName.split('.').pop() || '').toLowerCase();
    const entry = (index[courseId] ||= { sections: {}, loose: [] });
    const video = {
      id: `${courseId}/${rest}`,
      courseId,
      section,
      relativePath: rest,
      fileName,
      url,
      type: MIME[ext] || 'video/mp4',
      title: titleFromFilename(fileName)
    };
    if (section) (entry.sections[section] ||= []).push(video);
    else entry.loose.push(video);
  });
  Object.values(index).forEach((e) => {
    Object.values(e.sections).forEach((list) => list.sort((a, b) => collator.compare(a.relativePath, b.relativePath)));
    e.loose.sort((a, b) => collator.compare(a.fileName, b.fileName));
  });
  return index;
};

const videoIndex = buildVideoIndex(discovered);
export const getCourseVideos = (courseId) => videoIndex[courseId] || { sections: {}, loose: [] };

const assignInOrder = (lessons, videos, byLesson, used) => {
  lessons.forEach((lesson) => {
    if (!lesson.videoFile) return;
    const wanted = lesson.videoFile.toLowerCase();
    const hit = videos.find((v) => !used.has(v.id) && (v.fileName.toLowerCase() === wanted || v.relativePath.toLowerCase() === wanted));
    if (hit) { byLesson[lesson.id] = hit; used.add(hit.id); }
  });
  const queue = videos.filter((v) => !used.has(v.id));
  lessons.forEach((lesson) => {
    if (byLesson[lesson.id] || lesson.videoFile) return;
    const next = queue.shift();
    if (next) { byLesson[lesson.id] = next; used.add(next.id); }
  });
};

/** Pair a course's modules/lessons with its videos, section by section. */
export const matchCourseVideos = (modules, { sections, loose }) => {
  const byLesson = {};
  const used = new Set();
  const folders = Object.keys(sections);
  modules.forEach((mod, i) => {
    const folder = folders.find((f) => sectionNumber(f) === i + 1) || folders.find((f) => f === mod.id);
    if (folder) assignInOrder(mod.lessons, sections[folder], byLesson, used);
  });
  const allLessons = modules.flatMap((m) => m.lessons);
  assignInOrder(allLessons, loose, byLesson, used);
  const all = [...Object.values(sections).flat(), ...loose];
  return { byLesson, extras: all.filter((v) => !used.has(v.id)), total: all.length };
};
