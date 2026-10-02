import React, { useEffect, useRef } from 'react';
import { ArrowRight, ArrowUpRight, Sprout, Download, MessageCircleQuestion, Hammer, Infinity as InfinityIcon, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { courses, getLessonCount } from '../data/catalog';
import { faqData, principles } from '../data/faqData';
import { useScrollProgress } from '../hooks/useScroll';
import { useMediaQuery, usePrefersReducedMotion } from '../hooks/useMediaQuery';
import { TechMorph } from '../components/TechMorph';
import { CourseMark } from '../components/CourseMark';
import { Reveal } from '../components/Reveal';
import { LiveWorkspaceDemo } from '../components/LiveWorkspaceDemo';

const FREE_LESSON = { courseId: 'javascript-in-depth', lessonId: 'js-01' };

const PROMISES = [
  { icon: Sprout, title: 'We start at zero.', text: 'No assumed knowledge. Every new word is explained the first time it shows up — nothing is “obvious”.' },
  { icon: Download, title: 'Set up, step by step.', text: 'Need tools on your PC? We tell you exactly what to download, in what order, and how to check it works — so your code runs perfectly on your own machine.' },
  { icon: MessageCircleQuestion, title: 'Every line explained.', text: 'Hover any line and the Tutor tells you what it does in plain English. If it doesn’t know, it says so.' },
  { icon: Hammer, title: 'You build real things.', text: 'Not just quizzes. The core courses end with projects you build yourself and can show anyone.' },
  { icon: InfinityIcon, title: 'Your pace, forever.', text: 'Pay once and keep the course for life. No deadlines, no subscription, and your progress is always saved.' },
  { icon: ShieldCheck, title: 'Try first, risk-free.', text: 'The first lesson of every course is free. If a course isn’t for you, get a refund within 30 days.' }
];

const TECH = ['HTML', 'CSS', 'JavaScript', 'React', 'Node.js', 'Express', 'SQL', 'PostgreSQL', 'Java', 'Spring Boot', 'Git', 'Linux', 'Docker', 'GitHub Actions', 'Cloud'];

const WORKSPACE = [
  { id: 'video', n: '01', title: 'Watch', text: 'Short video lessons. Pause, rewind, and pick up exactly where you stopped.' },
  { id: 'editor', n: '02', title: 'Try it yourself', text: 'Type the code right under the video and see the result straight away. Nothing to install.' },
  { id: 'explain', n: '03', title: 'Understand', text: 'Stuck on a line? Hover it. The Tutor tells you what it does in plain English.' },
  { id: 'notes', n: '04', title: 'Keep going', text: 'Your notes and progress are saved to your account, so you always know what comes next.' }
];

// "We walk with you": the learner's path, from first install to finished project
const JOURNEY = [
  { when: 'Before you start', title: 'We get your computer ready — together.', text: 'A clear checklist of what to download and install, in order, with a quick way to check each one worked. No guessing, no “it works on my machine”.' },
  { when: 'Your first lesson', title: 'Small steps, never a wall of code.', text: 'A short video, then you type the code yourself right underneath it. You see it work before we add the next piece.' },
  { when: 'When you get stuck', title: 'Help right where you’re stuck.', text: 'Hover the line that confuses you and the Tutor explains it in plain English. Still unsure? Ask the assistant about your own code, inside the lesson.' },
  { when: 'Every day after', title: 'You always know what’s next.', text: 'Your code, notes and progress are saved. Come back tomorrow or next month and pick up exactly where you left off.' },
  { when: 'The finish line', title: 'A project that’s truly yours.', text: 'The core courses end with real projects you build yourself — something you can open, run and proudly show anyone.' }
];

/* ── Hero ─────────────────────────────────────────────────── */
const Hero = ({ onBrowse, onTry }) => {
  const reduced = usePrefersReducedMotion();
  // narrow screens stack the symbol under the copy instead of beside it
  const stacked = useMediaQuery('(max-width: 900px)');
  const scene = !reduced;
  const visualRef = useRef(null);
  return (
    <section className={`hero ${scene ? 'is-scene' : ''}`} aria-labelledby="hero-title">
      <div className="hero-sticky">
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="eyebrow is-accent hero-in" style={{ '--i': 0 }}>Monklogy · Coding courses, starting from zero</p>
            <h1 id="hero-title" className="hero-title">
              <span className="hero-in" style={{ '--i': 1 }}>Learn to code by</span>{' '}
              <em className="display-em hero-in" style={{ '--i': 2 }}>understanding it.</em>
            </h1>
            <p className="hero-lede hero-in" style={{ '--i': 3 }}>
              Most people quit coding because tutorials show them what to type, but never why it works. Here you watch a
              short lesson, write the code yourself, and get every line explained in plain English.
            </p>
            <div className="hero-actions hero-in" style={{ '--i': 4 }}>
              <button className="btn btn-primary btn-lg" onClick={onTry}>
                Try a free lesson <ArrowRight size={16} />
              </button>
              <button className="btn btn-secondary btn-lg" onClick={onBrowse}>
                See all courses
              </button>
            </div>
            <ul className="hero-facts hero-in" style={{ '--i': 5 }}>
              <li>First lesson free · no card</li>
              <li>Pay once, keep it forever</li>
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
          <div ref={visualRef} className="hero-scene-visual" data-stacked={stacked ? 'true' : undefined}>
            <TechMorph scene sceneRef={visualRef} />
            <p className="hero-visual-hint mono" aria-hidden="true">move through it · click to morph · scroll to scatter</p>
          </div>
        )}
      </div>
    </section>
  );
};

/* ── Promises to beginners + where to start ──────────────── */
const Promises = ({ navigateTo }) => {
  const starters = courses.filter((c) => c.level.startsWith('Beginner'));
  return (
    <section className="promises" aria-labelledby="promises-title">
      <div className="container">
        <Reveal className="section-head">
          <p className="eyebrow is-accent">Our promise to beginners</p>
          <h2 id="promises-title">If you’ve never written code, you’re exactly who this is for.</h2>
          <p>Six things we promise every beginner — in writing, before you spend a rupee.</p>
        </Reveal>

        <ol className="promise-grid">
          {PROMISES.map((p, i) => (
            <Reveal as="li" key={p.title} className="promise" delay={(i % 3) * 70}>
              <span className="promise-icon" aria-hidden="true"><p.icon size={18} /></span>
              <h3>{p.title}</h3>
              <p>{p.text}</p>
            </Reveal>
          ))}
        </ol>

        <Reveal className="starters" delay={80}>
          <div className="starters-head">
            <h3>Courses that start at zero</h3>
            <p>No experience needed. Pick one and try the first lesson free.</p>
          </div>
          <ul className="starter-list">
            {starters.map((c) => (
              <li key={c.id}>
                <button className="starter" onClick={() => navigateTo('course-details', { courseId: c.id })}>
                  <CourseMark course={c} size={34} />
                  <span className="starter-body">
                    <span className="starter-name">{c.title}</span>
                    <span className="starter-meta mono">{c.level} · {getLessonCount(c.id)} lessons</span>
                  </span>
                  <ArrowUpRight size={16} className="starter-arrow" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </Reveal>
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

/* ── We walk with you: the guided path ─────────────────────── */
const WalkWithYou = () => {
  const pathRef = useRef(null);

  // Scroll-linked trail: the orange line grows down to a "reading line" in the
  // viewport, and each step lights up once the line reaches its dot.
  useEffect(() => {
    const path = pathRef.current;
    if (!path) return undefined;
    const steps = [...path.querySelectorAll('.walk-step')];
    let frame = 0;
    const update = () => {
      frame = 0;
      const mark = window.innerHeight * 0.62;
      const rect = path.getBoundingClientRect();
      const fill = Math.min(rect.height, Math.max(0, mark - rect.top));
      path.style.setProperty('--fill', `${fill.toFixed(1)}px`);
      steps.forEach((step) => {
        const dot = step.querySelector('.walk-dot').getBoundingClientRect();
        step.classList.toggle('is-lit', dot.top + dot.height / 2 <= mark);
      });
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
  <section className="container section walk" aria-labelledby="walk-title">
    <div className="walk-grid">
      <Reveal className="walk-intro">
        <p className="eyebrow is-accent">More than a tutor</p>
        <h2 id="walk-title">
          We don’t just teach you. <em className="display-em">We walk the whole way with you.</em>
        </h2>
        <p>
          Most people who quit coding don’t quit because it’s hard — they quit because they’re left alone with it.
          So from your very first install to your first finished project, we hold your hand at every step.
        </p>
      </Reveal>

      <ol ref={pathRef} className="walk-path">
        {JOURNEY.map((j, i) => (
          <Reveal as="li" key={j.when} className="walk-step" delay={i * 80}>
            <span className="walk-dot mono" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
            <p className="walk-when mono">{j.when}</p>
            <h3>{j.title}</h3>
            <p>{j.text}</p>
          </Reveal>
        ))}
      </ol>
    </div>
  </section>
  );
};

/* ── The learning environment: a live, inspectable workspace ─ */
const Workspace = () => (
  <section className="workspace-section" aria-labelledby="workspace-title">
    <div className="container">
      <Reveal className="section-head split">
        <div>
          <p className="eyebrow">Try it now — no sign-up</p>
          <h2 id="workspace-title">Write it. See it. Understand it.</h2>
        </div>
        <p>
          Every web page is made of three files: HTML for structure, CSS for style and JavaScript for behaviour.
          Hover any line to see what it does on the page, or hover the page to find the code behind it.
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
      <p className="eyebrow">The honest part</p>
      <h2 id="principles-title">Learning to code is hard. We won’t pretend it isn’t.</h2>
    </Reveal>
    <div className="principles">
      {principles.map((p, i) => (
        <Reveal key={p.title} className="principle" delay={i * 60}>
          <span className="principle-n mono">{String(i + 1).padStart(2, '0')}</span>
          <h3>{p.title}</h3>
          <p><strong>What we do about it: </strong>{p.description}</p>
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
      <p>The first lesson of every course is free. No card, and no trial that quietly turns into a bill.</p>
      <div className="hero-actions">
        <button className="btn btn-accent btn-lg" onClick={onTry}>Try a free lesson <ArrowRight size={16} /></button>
        <button className="btn btn-ghost btn-lg" onClick={onBrowse}>Browse all courses</button>
      </div>
    </Reveal>
  </section>
);

export const Lobby = () => {
  const { navigateTo } = useApp();
  const onBrowse = () => navigateTo('courses');
  const onTry = () => navigateTo('tutor', FREE_LESSON);

  return (
    <div className="lobby">
      <Hero onBrowse={onBrowse} onTry={onTry} />
      <Promises navigateTo={navigateTo} />
      <TechBand />
      <WalkWithYou />
      <Workspace />
      <Principles />
      <Faq />
      <FinalCta onBrowse={onBrowse} onTry={onTry} />
    </div>
  );
};
