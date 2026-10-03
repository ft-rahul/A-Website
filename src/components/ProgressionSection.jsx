import React, { useEffect, useRef, useState } from 'react';
import { Check, Lock } from 'lucide-react';
import { Reveal } from './Reveal';
import { useCountUp } from '../hooks/useCountUp';
import { useMediaQuery } from '../hooks/useMediaQuery';

// Example learner shown on the page. Everything here is illustrative.
const PROFILE = { level: 8, title: 'Full-Stack Builder', xp: 8420, nextXp: 10000 };
const UNLOCKED = ['React', 'Next.js', 'APIs', 'PostgreSQL'];
const MILESTONES = [
  { level: 2, title: 'First challenge passed', done: true },
  { level: 4, title: 'First project reviewed', done: true },
  { level: 6, title: 'Portfolio published', done: true },
  { level: 8, title: 'Full-stack app shipped', done: true },
  { level: 10, title: 'Production architecture', done: false }
];
const BADGES = [
  { mark: 'CR', title: 'Clean Review', text: 'Project passed with no blockers' },
  { mark: 'DB', title: 'Debugger', text: 'Fixed 25 failing tests' },
  { mark: '4W', title: 'Consistent', text: 'Four-week learning streak' }
];
const STATS = [
  { label: 'Challenges passed', value: 64 },
  { label: 'Projects completed', value: 3 },
  { label: 'Skills verified', value: 11 }
];

// Skill tree. Positions are percentages of the tree area: [wide layout, narrow layout].
const NODES = {
  html: { label: 'HTML & CSS', state: 'done', at: [[16, 18], [27, 7]] },
  js: { label: 'JavaScript', state: 'done', at: [[16, 78], [73, 7]] },
  react: { label: 'React', state: 'done', at: [[42, 48], [50, 27]] },
  next: { label: 'Next.js', state: 'done', at: [[65, 13], [25, 48]] },
  apis: { label: 'APIs', state: 'done', at: [[65, 54], [73, 48]] },
  pg: { label: 'PostgreSQL', state: 'done', at: [[63, 90], [73, 70]] },
  prod: { label: 'Production Architecture', state: 'next', at: [[89, 33], [27, 72]] },
  sys: { label: 'System Design', state: 'locked', at: [[89, 78], [62, 93]] }
};
const EDGES = [
  ['html', 'react'], ['js', 'react'], ['react', 'next'], ['react', 'apis'],
  ['next', 'prod'], ['apis', 'prod'], ['apis', 'pg'], ['pg', 'sys']
];

// How far each skill sits from the roots: the tree grows in this order
const DEPTH = {};
const depthOf = (id) => {
  if (DEPTH[id] === undefined) {
    const parents = EDGES.filter(([, b]) => b === id).map(([a]) => a);
    DEPTH[id] = parents.length ? Math.max(...parents.map(depthOf)) + 1 : 0;
  }
  return DEPTH[id];
};
// Everything a skill builds on (itself included)
const chainOf = (id, seen = new Set()) => {
  seen.add(id);
  EDGES.forEach(([a, b]) => { if (b === id && !seen.has(a)) chainOf(a, seen); });
  return seen;
};
const STEP = 0.42; // seconds between generations

const SkillTree = () => {
  const narrow = useMediaQuery('(max-width: 640px)');
  const v = narrow ? 1 : 0;
  const [focus, setFocus] = useState(null);
  const chain = focus ? chainOf(focus) : null;
  // Curves are drawn in real pixels so they keep their shape at any size
  const treeRef = useRef(null);
  const [size, setSize] = useState({ w: 100, h: 100 });
  useEffect(() => {
    const el = treeRef.current;
    if (!el || !('ResizeObserver' in window)) return undefined;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width || 100, h: e.contentRect.height || 100 }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pt = (id) => [(NODES[id].at[v][0] / 100) * size.w, (NODES[id].at[v][1] / 100) * size.h];
  const path = (a, b) => {
    const [x1, y1] = pt(a);
    const [x2, y2] = pt(b);
    if (Math.abs(x1 - x2) < 1 || Math.abs(y1 - y2) < 1 || NODES[b].state === 'locked') return `M${x1} ${y1} L${x2} ${y2}`;
    if (narrow) {
      const my = (y1 + y2) / 2;
      return `M${x1} ${y1} C${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`;
    }
    const mx = (x1 + x2) / 2;
    return `M${x1} ${y1} C${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
  };
  const tone = (id) => (chain ? (chain.has(id) ? 'is-lit' : 'is-dim') : '');

  return (
    <div ref={treeRef} className={`tree ${chain ? 'has-focus' : ''}`} data-layout={narrow ? 'narrow' : 'wide'}>
      <svg className="tree-edges" viewBox={`0 0 ${size.w} ${size.h}`} aria-hidden="true">
        {EDGES.map(([a, b], i) => {
          const d = path(a, b);
          const state = NODES[b].state;
          const lit = chain ? (chain.has(a) && chain.has(b) ? 'is-lit' : 'is-dim') : '';
          const timing = { '--delay': `${depthOf(a) * STEP + 0.2}s`, '--dur': `${STEP}s`, '--flow-delay': `${2.4 + i * 0.37}s` };
          return (
            <g key={`${a}-${b}`} className={`tree-link is-${state} ${lit}`} style={timing}>
              <path d={d} className="tree-edge" pathLength="1" />
              {state !== 'locked' && <path d={d} className="tree-flow" pathLength="1" />}
            </g>
          );
        })}
      </svg>
      <ul className="tree-nodes" aria-label="Skill tree, web track">
        {Object.entries(NODES).map(([id, n]) => (
          <li
            key={id}
            className={`tree-node is-${n.state} ${tone(id)}`}
            style={{ left: `${n.at[v][0]}%`, top: `${n.at[v][1]}%`, '--delay': `${depthOf(id) * STEP + (depthOf(id) ? 0.15 : 0)}s` }}
            tabIndex={0}
            onMouseEnter={() => setFocus(id)}
            onMouseLeave={() => setFocus(null)}
            onFocus={() => setFocus(id)}
            onBlur={() => setFocus(null)}
          >
            {n.state === 'done' ? <Check size={12} aria-hidden="true" /> : <Lock size={12} aria-hidden="true" />}
            <span>{n.label}</span>
            <span className="sr-only">{n.state === 'done' ? ' (verified)' : n.state === 'next' ? ' (next milestone)' : ' (locked)'}</span>
          </li>
        ))}
      </ul>
      <p className="tree-hint mono" aria-hidden="true">Hover a skill to trace its path</p>
    </div>
  );
};

const Stat = ({ label, value, run }) => {
  const shown = useCountUp(run ? value : 0, 900);
  return (
    <div className="prog-stat">
      <span className="prog-label mono">{label}</span>
      <strong>{shown}</strong>
    </div>
  );
};

export const ProgressionSection = () => {
  const boardRef = useRef(null);
  const [run, setRun] = useState(false);

  // Fill the XP bar and count the numbers up the first time the board is seen
  useEffect(() => {
    const el = boardRef.current;
    if (!el || !('IntersectionObserver' in window)) { setRun(true); return undefined; }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setRun(true); io.disconnect(); }
    }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const xp = useCountUp(run ? PROFILE.xp : 0, 1100);
  const pct = (PROFILE.xp / PROFILE.nextXp) * 100;

  return (
    <section className="container section progression" aria-labelledby="progression-title">
      <Reveal className="section-head split">
        <div>
          <p className="eyebrow is-accent">Progression</p>
          <h2 id="progression-title">Levels that <em className="display-em">mean something.</em></h2>
        </div>
        <p>
          XP comes from proven work — passed challenges and reviewed projects, not minutes watched. Every level is
          something you can now actually do.
        </p>
      </Reveal>

      <Reveal delay={80}>
        <div ref={boardRef} className={`prog-board ${run ? 'is-live' : ''}`}>
          <div className="prog-level">
            <span className="prog-label mono">Level</span>
            <strong className="prog-level-n mono">{String(PROFILE.level).padStart(2, '0')}</strong>
            <h3>{PROFILE.title}</h3>
            <div className="prog-xp mono">
              <span>{xp.toLocaleString('en-IN')} XP</span>
              <span>{PROFILE.nextXp.toLocaleString('en-IN')}</span>
            </div>
            <div className="prog-bar" role="progressbar" aria-label="XP towards next level" aria-valuemin={0} aria-valuemax={PROFILE.nextXp} aria-valuenow={PROFILE.xp}>
              <span style={{ '--pct': `${pct}%` }} />
            </div>
            <span className="prog-label mono">Skills unlocked</span>
            <ul className="prog-chips">
              {UNLOCKED.map((s) => <li key={s}>{s}</li>)}
            </ul>
            <span className="prog-label mono">Next milestone</span>
            <p className="prog-next"><Lock size={14} aria-hidden="true" /> Production Architecture</p>
            <p className="prog-next-note">· needs 1 more reviewed project</p>
          </div>

          <div className="prog-tree">
            <span className="prog-label mono">Skill tree · Web track</span>
            <SkillTree />
          </div>

          <div className="prog-cell">
            <span className="prog-label mono">Milestones</span>
            <ul className="prog-milestones">
              {MILESTONES.map((m) => (
                <li key={m.level} className={m.done ? 'is-done' : ''}>
                  <span className="mono">L{String(m.level).padStart(2, '0')}</span>
                  {m.title}
                </li>
              ))}
            </ul>
          </div>

          <div className="prog-cell">
            <span className="prog-label mono">Badges</span>
            <ul className="prog-badges">
              {BADGES.map((b) => (
                <li key={b.mark}>
                  <span className="prog-hex mono" aria-hidden="true">
                    <svg viewBox="0 0 40 44"><path d="M20 2 L37 11.5 V32.5 L20 42 L3 32.5 V11.5 Z" /></svg>
                    <span>{b.mark}</span>
                  </span>
                  <span>
                    <strong>{b.title}</strong>
                    <span>{b.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="prog-cell prog-stats">
            {STATS.map((s) => <Stat key={s.label} {...s} run={run} />)}
          </div>
        </div>
        <p className="prog-footnote mono">Example learner profile. Levels, badges and numbers shown are illustrative.</p>
      </Reveal>
    </section>
  );
};
