import React, { useState } from 'react';
import { formatPrice, formatPriceExact } from '../lib/money';
import { ArrowRight, X, Download, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getCourse, getCurriculum } from '../data/catalog';
import { downloadReceipt } from '../lib/receipt';
import { Modal } from './Modal';
import { CourseMark } from './CourseMark';

/**
 * Payment confirmation.
 * A small green ball drops, lands with a squash, bursts into the badge and the
 * tick draws in — then the receipt appears. One short, physical moment; no confetti.
 */
export const EnrollmentCelebration = () => {
  const { celebration, dismissCelebration, navigateTo } = useApp();
  const [saved, setSaved] = useState(false);

  if (!celebration) return null;
  const enrolled = celebration.courseIds.map(getCourse).filter(Boolean);
  const course = enrolled[0];
  if (!course) return null;
  const { lessons } = getCurriculum(course.id);
  const paid = celebration.paid ?? enrolled.reduce((s, c) => s + c.price, 0);
  const at = new Date(celebration.at);
  const date = at.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const time = at.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  const close = () => {
    setSaved(false);
    dismissCelebration();
  };
  const start = () => {
    close();
    navigateTo('tutor', { courseId: course.id, lessonId: lessons[0]?.id });
  };
  const save = () => {
    downloadReceipt(celebration, enrolled);
    setSaved(true);
  };

  return (
    <Modal open onClose={close} labelledBy="paid-title" className="paid">
      <button className="icon-btn is-quiet paid-close" onClick={close} aria-label="Close">
        <X size={16} />
      </button>

      <div className="paid-drop" aria-hidden="true" key={celebration.at}>
        <span className="paid-shadow" />
        <span className="paid-burst" />
        <span className="paid-ball">
          <svg viewBox="0 0 56 56" width="56" height="56">
            <path d="M17 29l7.5 7.5L40 21" className="paid-tick" />
          </svg>
        </span>
      </div>

      <div className="paid-reveal">
        <div className="paid-reveal-inner">
        <h2 id="paid-title" className="paid-title">Payment successful</h2>
        <p className="paid-lede">
          You are enrolled in {enrolled.length > 1 ? `${enrolled.length} courses` : course.title}. Your access starts now.
        </p>

        <ul className="paid-courses">
          {enrolled.map((c) => (
            <li key={c.id}>
              <CourseMark course={c} size={32} />
              <span className="paid-course-name">{c.title}</span>
              <span className="mono">{formatPrice(c.price)}</span>
            </li>
          ))}
        </ul>

        <dl className="paid-receipt">
          <div><dt>Amount paid</dt><dd className="mono">{formatPriceExact(paid)}</dd></div>
          <div><dt>Paid with</dt><dd>{celebration.method}</dd></div>
          <div><dt>Date and time</dt><dd>{date}, {time}</dd></div>
          <div><dt>Transaction ID</dt><dd className="mono">{celebration.transactionId}</dd></div>
        </dl>

        <div className="paid-actions">
          <button className="btn btn-primary btn-block btn-lg" onClick={start} data-autofocus>
            Start {enrolled.length > 1 ? course.title : 'lesson 1'} <ArrowRight size={16} />
          </button>
          <div className="paid-row">
            <button className="btn btn-secondary" onClick={save}>
              {saved ? <><Check size={15} /> Receipt saved</> : <><Download size={15} /> Download receipt</>}
            </button>
            <button className="btn btn-ghost" onClick={() => { close(); navigateTo('my-courses'); }}>
              My courses
            </button>
          </div>
        </div>
        </div>
      </div>
    </Modal>
  );
};
