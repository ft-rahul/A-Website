import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Reveal } from './Reveal';

const SHIFTS = [
  { from: 'Watching', to: 'Doing' },
  { from: 'Completion', to: 'Capability' },
  { from: 'Same syllabus for everyone', to: 'A path built around you' }
];

// Chart space is 520 × 300; the axes sit at x = 24 and y = 280.
const TYPICAL_PATH = 'M30 272 C 110 270, 150 108, 230 104 S 360 150, 410 200 S 480 238, 510 244';
const STEPS = [272, 232, 195, 155, 112, 70, 32];
const MONK_PATH = STEPS.reduce((d, y, i) => {
  const x = 30 + i * 70;
  if (i === 0) return `M${x} ${y} H${x + 52}`;
  return `${d} L${x - 10} ${y} H${Math.min(x + 52, 510)}`;
}, '');

const MODES = {
  typical: {
    label: 'Typical course',
    caption: 'You feel it climb while you watch. A few weeks later, most of it has faded.',
    flow: ['Watch', 'Complete', 'Move on', 'Forget']
  },
  monk: {
    label: 'Monklogy',
    caption: 'Every step is practised and checked before the next one, so it stays.',
    flow: ['Understand', 'Practice', 'Build', 'Get feedback', 'Improve', 'Master']
  }
};

const LearningCurve = () => {
  const [mode, setMode] = useState('monk');
  const active = MODES[mode];

  return (
    <div className="curve-card">
      <div className="curve-top">
        <div className="curve-toggle" role="group" aria-label="Compare learning curves">
          {Object.entries(MODES).map(([key, m]) => (
            <button key={key} type="button" aria-pressed={mode === key} className={mode === key ? 'is-on' : ''} onClick={() => setMode(key)}>
              {m.label}
            </button>
          ))}
        </div>
        <span className="curve-note mono">Illustrative</span>
      </div>

      <figure className="curve-figure">
        <svg viewBox="0 0 520 300" className={`curve-svg is-${mode}`} role="img" aria-label={`${active.label}: ${active.caption}`}>
          {[70, 140, 210].map((y) => <line key={y} x1="24" x2="516" y1={y} y2={y} className="curve-grid" />)}
          <line x1="24" x2="24" y1="6" y2="280" className="curve-axis" />
          <line x1="24" x2="516" y1="280" y2="280" className="curve-axis" />
          <path d={TYPICAL_PATH} className={`curve-line is-typical ${mode === 'typical' ? 'is-active' : ''}`} key={`t-${mode}`} pathLength="1" />
          <path d={MONK_PATH} className={`curve-line is-monk ${mode === 'monk' ? 'is-active' : ''}`} key={`m-${mode}`} pathLength="1" />
        </svg>
        <span className="curve-y mono" aria-hidden="true">What you can actually do</span>
        <span className="curve-x mono" aria-hidden="true">Time</span>
        <figcaption className="curve-caption" key={mode}>{active.caption}</figcaption>
      </figure>

      <ol className={`curve-flow is-${mode}`} key={mode} aria-label={`${active.label} steps`}>
        {active.flow.map((step, i) => (
          <li key={step} style={{ '--i': i }}>
            {i > 0 && <ArrowRight size={13} className="curve-flow-arrow" aria-hidden="true" />}
            <span className="curve-flow-step">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
};

export const ProblemSection = () => (
  <section className="container section problem" aria-labelledby="problem-title">
    <div className="problem-grid">
      <Reveal className="problem-copy">
        <p className="eyebrow is-accent">The problem</p>
        <h2 id="problem-title">Most learning ends right where <em className="display-em">skill should begin.</em></h2>
        <p className="problem-lede">
          Courses are designed to be finished. You watch, you complete, you move on — and a few weeks later most of it
          is gone. Nothing checked whether you could actually use it.
        </p>
        <ul className="shift-list">
          {SHIFTS.map((s) => (
            <li key={s.from}>
              <s>{s.from}</s>
              <ArrowRight size={15} className="shift-arrow" aria-label="becomes" />
              <span>{s.to}</span>
            </li>
          ))}
        </ul>
      </Reveal>
      <Reveal delay={100}>
        <LearningCurve />
      </Reveal>
    </div>
  </section>
);
