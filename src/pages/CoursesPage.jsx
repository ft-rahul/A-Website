import React, { useMemo, useState } from 'react';
import { formatPrice } from '../lib/money';
import { Search, Check, ArrowRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { courses, CATEGORY_ORDER, getLessonCount } from '../data/catalog';
import { CourseMark } from '../components/CourseMark';
import { Reveal } from '../components/Reveal';

export const CourseCard = ({ course, index }) => {
  const { navigateTo, isOwned, addToCart, startPurchaseFlow, cart } = useApp();
  const owned = isOwned(course.id);
  const inCart = cart.some((c) => c.id === course.id);
  const open = () => navigateTo('course-details', { courseId: course.id });

  return (
    <article className="course-card">
      <div className="course-card-top">
        <CourseMark course={course} size={52} />
        <span className="course-card-cat mono">{course.category}</span>
      </div>
      <h3 className="course-card-title">
        <button onClick={open} className="course-card-link">
          {course.title}
          <span className="course-card-sub">{course.subtitle}</span>
        </button>
      </h3>
      <p className="course-card-summary">{course.summary}</p>
      <ul className="course-card-meta mono" aria-label="Course details">
        <li>{course.level}</li>
        <li>{getLessonCount(course.id)} lessons</li>
        <li>{course.hours} hours</li>
      </ul>
      <div className="course-card-foot">
        {owned ? (
          <>
            <span className="tag is-success"><Check size={12} /> Enrolled</span>
            <button className="btn btn-primary btn-sm" onClick={() => navigateTo('tutor', { courseId: course.id })}>
              Continue <ArrowRight size={14} />
            </button>
          </>
        ) : (
          <>
            <span className="course-card-price">{formatPrice(course.price)}</span>
            <div className="course-card-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => addToCart(course)} disabled={inCart}>
                {inCart ? 'In cart' : 'Add to cart'}
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => startPurchaseFlow(course)}>
                Enrol
              </button>
            </div>
          </>
        )}
      </div>
      <span className="course-card-index mono" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
    </article>
  );
};

export const CoursesPage = () => {
  const [category, setCategory] = useState('All');
  const [query, setQuery] = useState('');

  const categories = ['All', ...CATEGORY_ORDER.filter((c) => courses.some((x) => x.category === c))];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return courses.filter((c) => {
      if (category !== 'All' && c.category !== category) return false;
      if (!q) return true;
      return [c.title, c.subtitle, c.summary, c.category, ...c.skills].some((t) => t.toLowerCase().includes(q));
    });
  }, [category, query]);

  return (
    <div className="page">
      <div className="container">
        <header className="page-header">
          <p className="eyebrow is-accent">Course catalog</p>
          <h1>Courses</h1>
          <p>Four core tracks from first line to production, and focused courses on the tools inside them.</p>
        </header>

        <div className="catalog-bar">
          <div className="tabs" role="tablist" aria-label="Filter by category">
            {categories.map((c) => (
              <button
                key={c}
                role="tab"
                aria-selected={category === c}
                className={`tab ${category === c ? 'is-active' : ''}`}
                onClick={() => setCategory(c)}
              >
                {c}
                <span className="tab-count mono">{c === 'All' ? courses.length : courses.filter((x) => x.category === c).length}</span>
              </button>
            ))}
          </div>
          <label className="search">
            <Search size={15} aria-hidden="true" />
            <span className="sr-only">Search courses</span>
            <input type="search" placeholder="Search courses or skills" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
        </div>

        {filtered.length ? (
          <div className="course-grid" role="tabpanel">
            {filtered.map((c, i) => (
              <Reveal key={c.id} delay={Math.min(i, 5) * 40}>
                <CourseCard course={c} index={courses.indexOf(c)} />
              </Reveal>
            ))}
          </div>
        ) : (
          <div className="empty">
            <h2>No courses match “{query}”</h2>
            <p>Try a skill such as React, SQL or Docker, or clear the filters.</p>
            <button className="btn btn-secondary" onClick={() => { setQuery(''); setCategory('All'); }}>Clear filters</button>
          </div>
        )}
      </div>
    </div>
  );
};
