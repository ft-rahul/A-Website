import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Flag, Lock, Trophy, X } from 'lucide-react';
import { Modal } from './Modal';
import { useMediaQuery } from '../hooks/useMediaQuery';

const ROW = 128; // vertical space per stop

/** Where a module stands for this learner. */
const moduleState = (m, { completed, currentId, owned }) => {
  const done = m.lessons.filter((l) => completed.has(l.id)).length;
  const open = owned || m.lessons.some((l) => l.preview);
  let state = 'upcoming';
  if (m.lessons.length && done === m.lessons.length) state = 'done';
  else if (m.lessons.some((l) => l.id === currentId)) state = 'current';
  else if (!open) state = 'locked';
  return { done, state };
};

/**
 * The course as a winding road: one stop per module, the learner's position
 * marked, the travelled part lit, and every lesson one click away.
 */
export const CourseRoadmap = ({ open, onClose, course, modules, completed, current, owned, theme, onOpenLesson }) => {
  const narrow = useMediaQuery('(max-width: 640px)');
  const boxRef = useRef(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const el = boxRef.current;
    if (!open || !el || !('ResizeObserver' in window)) return undefined;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width || 640));
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  const stops = modules.map((m) => ({ module: m, ...moduleState(m, { completed, currentId: current?.id, owned }) }));
  const total = modules.reduce((n, m) => n + m.lessons.length, 0);
  const doneCount = stops.reduce((n, s) => n + s.done, 0);
  const allDone = total > 0 && doneCount === total;
  const hereIndex = allDone ? stops.length : Math.max(0, stops.findIndex((s) => s.state === 'current'));

  // The road wiggles down the middle with cards on the outside; on phones it runs down the left edge
  const xOf = (i) => (narrow ? 26 : i % 2 === 0 ? width * 0.42 : width * 0.58);
  const yOf = (i) => ROW / 2 + i * ROW;
  const count = stops.length + 1; // + the finish line
  const height = count * ROW;
  let d = `M${xOf(0)} ${yOf(0) - ROW / 2}`;
  for (let i = 0; i < count; i++) {
    const [x, y] = [xOf(i), yOf(i)];
    if (i === 0) d += ` L${x} ${y}`;
    else d += ` C${xOf(i - 1)} ${yOf(i - 1) + ROW / 2}, ${x} ${y - ROW / 2}, ${x} ${y}`;
  }
  // The road runs from the top edge to the finish; the lit part ends where the learner is
  const travelled = (hereIndex * ROW + ROW / 2) / (height - ROW / 2);

  return (
    <Modal open={open} onClose={onClose} labelledBy="roadmap-title" className="roadmap-modal">
      <div className="tutor-themed roadmap" data-tutor-theme={theme}>
        <header className="roadmap-head">
          <div>
            <p className="roadmap-kicker mono">Your roadmap</p>
            <h2 id="roadmap-title">{course.title}</h2>
            <p className="roadmap-sub">
              {allDone ? 'Every lesson done. You finished the course.' : (
                <>You’re on lesson {current?.number} of {total}: <strong>{current?.title}</strong></>
              )}
            </p>
          </div>
          <div className="roadmap-ring" style={{ '--p': total ? doneCount / total : 0 }} aria-label={`${doneCount} of ${total} lessons done`}>
            <svg viewBox="0 0 44 44" aria-hidden="true">
              <circle cx="22" cy="22" r="19" className="roadmap-ring-track" />
              <circle cx="22" cy="22" r="19" className="roadmap-ring-fill" pathLength="1" />
            </svg>
            <span className="mono">{total ? Math.round((doneCount / total) * 100) : 0}%</span>
          </div>
          <button className="icon-btn roadmap-close" onClick={onClose} aria-label="Close roadmap"><X size={17} /></button>
        </header>

        <div className="roadmap-scroll">
          <div ref={boxRef} className={`roadmap-map ${narrow ? 'is-narrow' : ''}`} style={{ height, '--map-w': `${width}px` }}>
            <svg className="roadmap-road" width={width} height={height} aria-hidden="true">
              <path d={d} className="roadmap-road-base" />
              <path d={d} className="roadmap-road-lit" pathLength="1" style={{ '--f': travelled }} />
              <path d={d} className="roadmap-road-flow" pathLength="1" style={{ '--f': travelled }} />
            </svg>

            <ol className="roadmap-stops">
              {stops.map((s, i) => {
                const side = narrow || i % 2 === 1 ? 'right' : 'left';
                return (
                  <li
                    key={s.module.id}
                    className={`roadmap-stop is-${s.state} card-${side}`}
                    style={{ left: xOf(i), top: yOf(i), '--i': i }}
                  >
                    <span className="roadmap-node" aria-hidden="true">
                      {s.state === 'done' ? <Check size={15} /> : s.state === 'locked' ? <Lock size={13} /> : <span className="mono">{i + 1}</span>}
                    </span>
                    {i === hereIndex && (
                      <span className="roadmap-here" aria-hidden="true"><Flag size={11} /> You are here</span>
                    )}
                    <div className="roadmap-card">
                      <span className="roadmap-card-meta mono">
                        Module {i + 1} · {s.done}/{s.module.lessons.length}
                        {i === hereIndex && <span className="roadmap-here-chip" aria-hidden="true">You are here</span>}
                        <span className="sr-only">{` lessons done, ${s.state === 'current' ? 'in progress' : s.state}`}</span>
                      </span>
                      <h3>{s.module.title}</h3>
                      <ul className="roadmap-lessons">
                        {s.module.lessons.map((l) => {
                          const can = owned || l.preview;
                          const isDone = completed.has(l.id);
                          const isHere = l.id === current?.id;
                          return (
                            <li key={l.id}>
                              <button
                                type="button"
                                className={`roadmap-lesson ${isDone ? 'is-done' : ''} ${isHere ? 'is-here' : ''} ${can ? '' : 'is-locked'}`}
                                onClick={() => onOpenLesson(l)}
                                title={`${l.number}. ${l.title}${isDone ? ' (done)' : can ? '' : ' (locked)'}`}
                                aria-label={`Lesson ${l.number}: ${l.title}${isDone ? ', done' : isHere ? ', current' : can ? '' : ', locked'}`}
                              />
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </li>
                );
              })}
              <li className={`roadmap-stop is-finish ${allDone ? 'is-done' : ''} card-${narrow || stops.length % 2 === 1 ? 'right' : 'left'}`} style={{ left: xOf(stops.length), top: yOf(stops.length), '--i': stops.length }}>
                <span className="roadmap-node" aria-hidden="true"><Trophy size={15} /></span>
                {allDone && <span className="roadmap-here" aria-hidden="true"><Flag size={11} /> You are here</span>}
                <div className="roadmap-card is-plain">
                  <span className="roadmap-card-meta mono">
                    Finish line
                    {allDone && <span className="roadmap-here-chip" aria-hidden="true">You are here</span>}
                  </span>
                  <h3>{course.title} complete</h3>
                </div>
              </li>
            </ol>
          </div>
        </div>

        <footer className="roadmap-foot">
          <ul className="roadmap-legend mono" aria-hidden="true">
            <li><span className="roadmap-lesson is-done" /> Done</li>
            <li><span className="roadmap-lesson is-here" /> You are here</li>
            <li><span className="roadmap-lesson" /> Up next</li>
            {!owned && <li><span className="roadmap-lesson is-locked" /> Locked</li>}
          </ul>
          {current && !allDone && (
            <button className="btn btn-accent btn-sm" onClick={() => onOpenLesson(current)} data-autofocus>
              Continue lesson {current.number} <ArrowRight size={14} />
            </button>
          )}
        </footer>
      </div>
    </Modal>
  );
};
