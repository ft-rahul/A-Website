import React from 'react';
import { ArrowRight, Flame, Compass } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { learnerStats } from '../lib/stats';
import { CourseMark } from '../components/CourseMark';
import { Reveal } from '../components/Reveal';

const STATUS_CLASS = { 'Not started': '', 'In progress': 'is-accent', Completed: 'is-success' };

export const MyCourses = () => {
  const { purchasedCourseIds, courseProgress, activity, navigateTo } = useApp();
  const s = learnerStats({ purchasedCourseIds, courseProgress, activity });
  const ordered = [...s.perCourse].sort(
    (a, b) => (courseProgress[b.course.id]?.lastVisitedAt || '').localeCompare(courseProgress[a.course.id]?.lastVisitedAt || '')
  );

  return (
    <div className="page">
      <div className="container">
        <header className="page-header my-head">
          <p className="eyebrow is-accent">Your learning</p>
          <h1>My courses</h1>
          <button className="my-summary" onClick={() => navigateTo('profile')}>
            <span><Flame size={15} aria-hidden="true" /> {s.streak}-day streak</span>
            <span>{s.lessonsCompleted} lessons completed</span>
            <span>{s.rank.current.name}</span>
            <span className="my-summary-link">View profile <ArrowRight size={14} /></span>
          </button>
        </header>

        {ordered.length ? (
          <ol className="my-list">
            {ordered.map(({ course, completed, total, percent, current, status }, i) => (
              <Reveal as="li" key={course.id} delay={i * 50} className="my-row">
                <CourseMark course={course} size={56} className="my-mark" />
                <div className="my-main">
                  <div className="my-title-row">
                    <h2 className="my-title">{course.title}</h2>
                    <span className={`tag ${STATUS_CLASS[status]}`}>{status}</span>
                  </div>
                  <p className="my-current">
                    {status === 'Completed' ? 'All lessons complete' : <>Current lesson: <strong>{current?.title}</strong></>}
                  </p>
                  <div className="my-progress">
                    <div className="meter" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={`${course.title} progress`}>
                      <span style={{ width: `${percent}%` }} />
                    </div>
                    <span className="mono my-percent">{percent}%</span>
                    <span className="mono muted">{completed}/{total} lessons</span>
                  </div>
                </div>
                <div className="my-actions">
                  <button className="btn btn-primary" onClick={() => navigateTo('tutor', { courseId: course.id, lessonId: current?.id })}>
                    {status === 'Completed' ? 'Review' : status === 'Not started' ? 'Start' : 'Continue'} <ArrowRight size={15} />
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => navigateTo('course-details', { courseId: course.id })}>
                    Syllabus
                  </button>
                </div>
              </Reveal>
            ))}
          </ol>
        ) : (
          <div className="empty">
            <Compass size={28} aria-hidden="true" />
            <h2>No courses yet</h2>
            <p>Enrol in a course and it will appear here with your progress and current lesson.</p>
            <button className="btn btn-primary" onClick={() => navigateTo('courses')}>Browse courses <ArrowRight size={15} /></button>
          </div>
        )}
      </div>
    </div>
  );
};
