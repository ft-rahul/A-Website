import React, { useMemo, useRef } from 'react';
import { formatPrice } from '../lib/money';
import { ArrowRight, ArrowUpRight, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { courses, getLessonCount } from '../data/catalog';
import { faqData, principles } from '../data/faqData';
import { explainLine } from '../lib/explain';
import { useScrollProgress } from '../hooks/useScroll';
import { useMediaQuery, usePrefersReducedMotion } from '../hooks/useMediaQuery';
import { TechMorph } from '../components/TechMorph';
import { CourseMark } from '../components/CourseMark';
import { Reveal } from '../components/Reveal';
import { LiveWorkspaceDemo } from '../components/LiveWorkspaceDemo';

const FREE_LESSON = { courseId: 'javascript-in-depth', lessonId: 'js-01' };

const STORY_CODE = `async function showUser(id) {
  const res = await fetch(\`/api/users/\${id}\`);
  const user = await res.json();
  title.textContent = user.name;
}`;
const STORY_LINES = [0, 1, 2, 3];

const TECH = ['HTML', 'CSS', 'JavaScript', 'React', 'Node.js', 'Express', 'SQL', 'PostgreSQL', 'Java', 'Spring Boot', 'Git', 'Linux', 'Docker', 'GitHub Actions', 'Cloud'];

const WORKSPACE = [
  { id: 'video', n: '01', title: 'Video lesson', text: 'Short, focused lessons with chapters you can rewatch at your own speed. Your position is remembered.' },
  { id: 'editor', n: '02', title: 'Live workspace', text: 'Write HTML, CSS and JavaScript beside the video and run it instantly in a sandboxed preview with a console.' },
  { id: 'explain', n: '03', title: 'Behind the scenes', text: 'Put your cursor on any line. The Tutor explains what the browser, engine or server actually does with it.' },
  { id: 'notes', n: '04', title: 'Notes and progress', text: 'Notes saved per lesson, progress per course, and a profile that shows how far you have come.' }
];

/* ── Hero ─────────────────────────────────────────────────── */
const Hero = ({ onBrowse, onTry }) => {
  const reduced = usePrefersReducedMotion();
  const wide = useMediaQuery('(min-width: 901px)');
  const scene = wide && !reduced;
  const visualRef = useRef(null);
  return (
    <section className={`hero ${scene ? 'is-scene' : ''}`} aria-labelledby="hero-title">
      <div className="hero-sticky">
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="eyebrow is-accent hero-in" style={{ '--i': 0 }}>Monklogy · Software development courses</p>
            <h1 id="hero-title" className="hero-title">
              <span className="hero-in" style={{ '--i': 1 }}>Learn what your code</span>{' '}
              <em className="display-em hero-in" style={{ '--i': 2 }}>actually does.</em>
            </h1>
            <p className="hero-lede hero-in" style={{ '--i': 3 }}>
              Full-stack, frontend, Java and DevOps — taught through focused video lessons, a live code workspace, and a
              tutor that explains what happens behind every line you write.
            </p>
            <div className="hero-actions hero-in" style={{ '--i': 4 }}>
              <button className="btn btn-primary btn-lg" onClick={onBrowse}>
                Explore courses <ArrowRight size={16} />
              </button>
              <button className="btn btn-secondary btn-lg" onClick={onTry}>
                Try a free lesson
              </button>
            </div>
            <ul className="hero-facts hero-in" style={{ '--i': 5 }}>
              <li>{courses.length} courses</li>
              <li>One-time purchase</li>
              <li>30-day refund</li>
            </ul>
          </div>
          {!scene && (
            <div className="hero-visual">
              <TechMorph />
              <p className="hero-visual-hint mono" aria-hidden="true">move through it · click to morph</p>
            </div>
          )}
        </div>
        {scene && (
          <div ref={visualRef} className="hero-scene-visual">
            <TechMorph scene sceneRef={visualRef} />
            <p className="hero-visual-hint mono" aria-hidden="true">move through it · click to morph · scroll to scatter</p>
          </div>
        )}
      </div>
    </section>
  );
};

/* ── Scroll story: one async function, four lines ─────────── */
const Story = () => {
  const reduced = usePrefersReducedMotion();
  const narrow = useMediaQuery('(max-width: 900px)');
  const staticMode = reduced || narrow;
  const { ref, step } = useScrollProgress({ mode: 'through', steps: STORY_LINES.length, disabled: staticMode });
  const lines = STORY_CODE.split('\n');
  const explanations = useMemo(
    () => STORY_LINES.map((i) => explainLine({ code: STORY_CODE, lineIndex: i, language: 'javascript' })),
    []
  );

  const codeCard = (active) => (
    <div className="story-code" aria-label="Example code">
      <div className="story-code-bar">
        <span className="mono">profile.js</span>
        <span className="story-code-step mono">
          {active >= 0 ? `line ${STORY_LINES[active] + 1}` : `${lines.length} lines`}
        </span>
      </div>
      <pre>
        {lines.map((l, i) => (
          <div key={i} className={`story-line ${STORY_LINES[active] === i ? 'is-active' : ''}`}>
            <span className="story-ln" aria-hidden="true">{i + 1}</span>
            <code>{l || ' '}</code>
          </div>
        ))}
      </pre>
    </div>
  );

  const header = (
    <div className="story-head">
      <p className="eyebrow is-accent">The Tutor</p>
      <h2>Every line, explained by what really happens.</h2>
      <p>
        This is the actual output of Monklogy’s line explainer. In a lesson, you get it for every line you write — just by
        moving your cursor.
      </p>
    </div>
  );

  if (staticMode) {
    return (
      <section className="story is-static" aria-labelledby="story-title">
        <div className="container">
          <div id="story-title">{header}</div>
          {codeCard(-1)}
          <ol className="story-static-steps">
            {explanations.map((e) => (
              <li key={e.lineNumber}>
                <code className="mono">{e.code.trim()}</code>
                <h3>{e.title}</h3>
                <p>{e.runtime}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    );
  }

  const e = explanations[step];
  return (
    <section ref={ref} className="story" style={{ '--steps': STORY_LINES.length }} aria-labelledby="story-title">
      <div className="story-sticky">
        <div className="container story-grid">
          <div id="story-title">
            {header}
            {codeCard(step)}
          </div>
          <div className="story-explain" aria-live="polite">
            <div className="story-progress" aria-hidden="true">
              {STORY_LINES.map((_, i) => (
                <span key={i} className={i <= step ? 'is-on' : ''} />
              ))}
            </div>
            <div className="story-explain-body" key={step}>
              <p className="story-kicker mono">Line {e.lineNumber} · what the runtime does</p>
              <h3>{e.title}</h3>
              <p className="story-runtime">{e.runtime}</p>
              <p className="story-next"><span className="mono">next →</span> {e.next}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

/* ── Technology band that drifts with scroll ──────────────── */
const TechBand = () => {
  const { ref } = useScrollProgress({ mode: 'pass' });
  return (
    <div ref={ref} className="techband" aria-hidden="true">
      <div className="techband-track">
        {[...TECH, ...TECH].map((t, i) => (
          <span key={i}>{t}</span>
        ))}
      </div>
    </div>
  );
};

/* ── Curriculum index ─────────────────────────────────────── */
const Curriculum = ({ navigateTo, isOwned }) => (
  <section className="container section" aria-labelledby="curriculum-title">
    <Reveal className="section-head split">
      <div>
        <p className="eyebrow">Curriculum</p>
        <h2 id="curriculum-title">Ten courses. One way of teaching.</h2>
      </div>
      <p>Four core tracks take you from first line to production. Focused courses go deep on the tools inside them.</p>
    </Reveal>

    <ol className="index-list">
      {courses.map((c, i) => (
        <Reveal as="li" key={c.id} delay={Math.min(i, 6) * 50}>
          <button className="index-row" onClick={() => navigateTo('course-details', { courseId: c.id })}>
            <span className="index-num mono">{String(i + 1).padStart(2, '0')}</span>
            <span className="index-mark"><CourseMark course={c} size={40} /></span>
            <span className="index-title">
              <span className="index-name">{c.title}</span>
              <span className="index-sub">{c.subtitle}</span>
            </span>
            <span className="index-meta mono">
              <span>{c.category}</span>
              <span>{getLessonCount(c.id)} lessons</span>
              <span>{c.hours} h</span>
            </span>
            <span className="index-end">
              {isOwned(c.id) ? (
                <span className="tag is-success"><Check size={12} /> Enrolled</span>
              ) : (
                <span className="index-price mono">{formatPrice(c.price)}</span>
              )}
              <ArrowUpRight size={18} className="index-arrow" aria-hidden="true" />
            </span>
          </button>
        </Reveal>
      ))}
    </ol>
  </section>
);

/* ── The learning environment: a live, inspectable workspace ─ */
const Workspace = () => (
  <section className="workspace-section" aria-labelledby="workspace-title">
    <div className="container">
      <Reveal className="section-head split">
        <div>
          <p className="eyebrow">The learning environment</p>
          <h2 id="workspace-title">Write it. Run it. Watch what really happens.</h2>
        </div>
        <p>
          This is the real workspace from every lesson. Hover a line to see the runtime at work — the call stack,
          the browser, the queues — then run it and compare the terminal’s output order.
        </p>
      </Reveal>
      <Reveal delay={80}>
        <LiveWorkspaceDemo />
      </Reveal>
      <ul className="workspace-points">
        {WORKSPACE.map((w) => (
          <li key={w.id}>
            <span className="mono">{w.n}</span>
            <strong>{w.title}</strong>
            <span>{w.text}</span>
          </li>
        ))}
      </ul>
    </div>
  </section>
);

/* ── Principles, FAQ, CTA ─────────────────────────────────── */
const Principles = () => (
  <section className="container section" aria-labelledby="principles-title">
    <Reveal className="section-head">
      <p className="eyebrow">How we teach</p>
      <h2 id="principles-title">Built by people who care how you learn.</h2>
    </Reveal>
    <div className="principles">
      {principles.map((p, i) => (
        <Reveal key={p.title} className="principle" delay={i * 60}>
          <span className="principle-n mono">{String(i + 1).padStart(2, '0')}</span>
          <h3>{p.title}</h3>
          <p>{p.description}</p>
        </Reveal>
      ))}
    </div>
  </section>
);

const Faq = () => (
  <section className="container-narrow section" aria-labelledby="faq-title">
    <Reveal className="section-head">
      <p className="eyebrow">Questions</p>
      <h2 id="faq-title">Before you enrol</h2>
    </Reveal>
    <div className="faq">
      {faqData.map((f, i) => (
        <details key={f.question} className="faq-item" open={i === 0}>
          <summary>{f.question}</summary>
          <p>{f.answer}</p>
        </details>
      ))}
    </div>
  </section>
);

const FinalCta = ({ onBrowse, onTry }) => (
  <section className="container section final-cta" aria-labelledby="cta-title">
    <Reveal>
      <h2 id="cta-title">
        Start with one lesson. <em className="display-em">See the difference.</em>
      </h2>
      <p>The first lesson of every course is free. Create an account, no card needed.</p>
      <div className="hero-actions">
        <button className="btn btn-accent btn-lg" onClick={onTry}>Try a free lesson <ArrowRight size={16} /></button>
        <button className="btn btn-ghost btn-lg" onClick={onBrowse}>Browse all courses</button>
      </div>
    </Reveal>
  </section>
);

export const Lobby = () => {
  const { navigateTo, isOwned } = useApp();
  const onBrowse = () => navigateTo('courses');
  const onTry = () => navigateTo('tutor', FREE_LESSON);

  return (
    <div className="lobby">
      <Hero onBrowse={onBrowse} onTry={onTry} />
      <Story />
      <TechBand />
      <Curriculum navigateTo={navigateTo} isOwned={isOwned} />
      <Workspace />
      <Principles />
      <Faq />
      <FinalCta onBrowse={onBrowse} onTry={onTry} />
    </div>
  );
};
