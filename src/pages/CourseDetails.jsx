import React, { useState } from 'react';
import { formatPrice } from '../lib/money';
import { ArrowLeft, ArrowRight, Check, PlayCircle, Lock, ChevronDown, Film, ShoppingBag } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getCourse, getCurriculum, summarizeProgress, courses } from '../data/catalog';
import { CourseMark } from '../components/CourseMark';

export const CourseDetails = () => {
  const { routeParams, navigateTo, addToCart, startPurchaseFlow, isOwned, courseProgress, cart } = useApp();
  const course = getCourse(routeParams.courseId) || courses[0];
  const { modules, lessons, videoCount } = getCurriculum(course.id);
  const owned = isOwned(course.id);
  const progress = summarizeProgress(course.id, courseProgress[course.id]);
  const completed = new Set(courseProgress[course.id]?.completedLessons || []);
  const inCart = cart.some((c) => c.id === course.id);
  const preview = lessons.find((l) => l.preview);
  const [open, setOpen] = useState(() => Object.fromEntries(modules.map((m, i) => [m.id, i === 0])));

  const openLesson = (lesson) => navigateTo('tutor', { courseId: course.id, lessonId: lesson.id });

  return (
    <div className="page course-page">
      <div className="container">
        <button className="back-link" onClick={() => navigateTo('courses')}>
          <ArrowLeft size={15} /> All courses
        </button>

        <div className="course-hero">
          <div className="course-hero-main">
            <div className="course-hero-mark"><CourseMark course={course} size={72} /></div>
            <p className="eyebrow is-accent">{course.category}</p>
            <h1>
              {course.title}
              <span className="course-hero-sub">{course.subtitle}</span>
            </h1>
            <p className="course-hero-lede">{course.description}</p>
            <dl className="course-facts">
              <div><dt>Level</dt><dd>{course.level}</dd></div>
              <div><dt>Lessons</dt><dd>{lessons.length}</dd></div>
              <div><dt>Time</dt><dd>{course.hours} hours</dd></div>
              <div><dt>Projects</dt><dd>{course.projects.length}</dd></div>
            </dl>
          </div>

          <aside className="enrol-card" aria-label="Enrolment">
            {owned ? (
              <>
                <p className="enrol-status"><Check size={15} /> You’re enrolled</p>
                <div className="meter" aria-label={`${progress.percent}% complete`}>
                  <span style={{ width: `${progress.percent}%` }} />
                </div>
                <p className="enrol-progress mono">{progress.completed} of {progress.total} lessons · {progress.percent}%</p>
                <button className="btn btn-accent btn-block btn-lg" onClick={() => openLesson(progress.current)}>
                  {progress.completed ? 'Continue learning' : 'Start the course'} <ArrowRight size={16} />
                </button>
                {progress.current && <p className="enrol-next">Next: {progress.current.title}</p>}
              </>
            ) : (
              <>
                <div className="enrol-price">
                  <span className="enrol-amount">{formatPrice(course.price)}</span>
                  <span className="enrol-once">one-time</span>
                </div>
                <button className="btn btn-accent btn-block btn-lg" onClick={() => startPurchaseFlow(course)}>
                  Enrol now
                </button>
                <button className="btn btn-secondary btn-block" onClick={() => (inCart ? navigateTo('cart') : addToCart(course))}>
                  <ShoppingBag size={15} /> {inCart ? 'View cart' : 'Add to cart'}
                </button>
                {preview && (
                  <button className="btn btn-ghost btn-block" onClick={() => openLesson(preview)}>
                    <PlayCircle size={15} /> Watch the free lesson
                  </button>
                )}
              </>
            )}
            <ul className="enrol-includes">
              <li>{lessons.length} lessons with a live workspace</li>
              <li>Line-by-line Tutor explanations</li>
              <li>Notes and progress saved per lesson</li>
              <li>30-day refund</li>
            </ul>
          </aside>
        </div>

        <div className="course-columns">
          <section aria-labelledby="learn-title">
            <h2 id="learn-title" className="section-title">What you’ll be able to do</h2>
            <ul className="checklist">
              {course.outcomes.map((o) => <li key={o}><Check size={15} aria-hidden="true" /> {o}</li>)}
            </ul>
          </section>
          <section aria-labelledby="for-title">
            <h2 id="for-title" className="section-title">Who it’s for</h2>
            <ul className="plainlist">
              {course.audience.map((a) => <li key={a}>{a}</li>)}
            </ul>
            <h3 className="subhead">Skills</h3>
            <ul className="skill-tags">
              {course.skills.map((s) => <li key={s} className="tag">{s}</li>)}
            </ul>
          </section>
        </div>

        <section className="syllabus" aria-labelledby="syllabus-title">
          <div className="syllabus-head">
            <h2 id="syllabus-title" className="section-title">Syllabus</h2>
            <p className="mono muted">
              {lessons.length} lessons · {videoCount ? `${videoCount} video${videoCount > 1 ? 's' : ''} available` : 'videos coming soon'}
            </p>
          </div>
          {modules.map((m, mi) => {
            const isOpen = open[m.id];
            return (
              <div key={m.id} className={`module ${isOpen ? 'is-open' : ''}`}>
                <button
                  className="module-toggle"
                  aria-expanded={isOpen}
                  aria-controls={`module-${m.id}`}
                  onClick={() => setOpen((o) => ({ ...o, [m.id]: !o[m.id] }))}
                >
                  <span className="mono module-n">{String(mi + 1).padStart(2, '0')}</span>
                  <span className="module-title">{m.title}</span>
                  <span className="mono module-count">{m.lessons.length} lessons</span>
                  <ChevronDown size={16} className="module-chevron" aria-hidden="true" />
                </button>
                {isOpen && (
                  <ol id={`module-${m.id}`} className="module-lessons">
                    {m.lessons.map((l) => {
                      const accessible = owned || l.preview;
                      return (
                        <li key={l.id}>
                          <button className="lesson-row" onClick={() => openLesson(l)} disabled={!accessible} aria-label={`${l.title}${accessible ? '' : ' (locked)'}`}>
                            <span className="lesson-row-state" aria-hidden="true">
                              {completed.has(l.id) ? <Check size={14} /> : accessible ? <PlayCircle size={14} /> : <Lock size={13} />}
                            </span>
                            <span className="lesson-row-main">
                              <span className="lesson-row-title">{l.title}</span>
                              <span className="lesson-row-summary">{l.summary}</span>
                            </span>
                            <span className="lesson-row-meta mono">
                              {l.preview && !owned && <span className="tag is-accent">Free</span>}
                              {l.video && <Film size={13} aria-label="Video available" />}
                              {l.duration}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            );
          })}
        </section>

        <section aria-labelledby="projects-title" className="projects">
          <h2 id="projects-title" className="section-title">What you’ll build</h2>
          <ol className="project-list">
            {course.projects.map((p, i) => (
              <li key={p.title}>
                <span className="mono project-n">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h3>{p.title}</h3>
                  <p>{p.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
};
