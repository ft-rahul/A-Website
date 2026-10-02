import React, { useEffect, useMemo, useState } from 'react';
import { Play, Pause, ChevronLeft, ChevronRight } from 'lucide-react';
import { usePrefersReducedMotion } from '../hooks/useMediaQuery';

/*
 * Visual "behind the scenes" simulation for one line of code.
 * JavaScript:
 * The scene is chosen from the line's syntax (await, timers, promises, logging,
 * declarations, calls…) and played as a short sequence of snapshots across the
 * runtime's lanes: call stack, browser (Web APIs), microtask queue, task queue,
 * memory and console. It is a teaching model of the event loop, not a trace of
 * the user's program — the caption says so.
 * HTML: tokenizer → DOM tree (using the real open elements above the line) → screen/network.
 * CSS: selector → computed style → which rendering steps a property triggers.
 */

const JS_LANES = [
  ['stack', 'Call stack'],
  ['webapi', 'Browser APIs'],
  ['micro', 'Microtasks'],
  ['task', 'Task queue'],
  ['mem', 'Memory'],
  ['out', 'Console']
];

const S = (caption, lanes = {}) => ({ caption, ...lanes });

const nameOf = (line, re, fallback) => (line.match(re) || [])[1] || fallback;

export const sceneFor = (raw, language = 'javascript', before = []) => {
  if (language === 'html') return htmlScene(raw, before);
  if (language === 'css') return cssScene(raw, before);
  return jsScene(raw);
};

export const hasSimulation = (language) => ['javascript', 'html', 'css'].includes(language);

const jsScene = (raw) => {
  const line = (raw || '').trim();
  if (!line || /^\/\//.test(line)) return { kind: 'idle', steps: [S('Nothing runs on this line — the parser skips blank lines and comments.')] };

  if (/^[}\])]+[;,)]*$/.test(line)) {
    return {
      kind: 'call',
      steps: [
        S('The closing brace ends the block when the function runs', { stack: ['(script)', 'fn()'] }),
        S('No explicit return, so it returns undefined and its frame pops', { stack: ['(script)'] })
      ]
    };
  }
  if (/\bawait\b/.test(line)) {
    const v = nameOf(line, /(?:const|let|var)\s+([\w$]+)/, 'result');
    const fn = nameOf(line, /await\s+([\w$.]+)\s*\(/, 'promise');
    return {
      kind: 'await',
      steps: [
        S(`${fn}() is called — its frame goes onto the stack`, { stack: ['async fn()', `${fn}()`] }),
        S(`${fn}() returns a pending Promise; the work continues in the browser`, { stack: ['async fn()'], webapi: [`${fn} ⏳ pending`] }),
        S('await suspends the async function — the stack is free, the page stays responsive', { webapi: [`${fn} ⏳ pending`], stack: [] }),
        S('Other code and events can run meanwhile', { stack: ['other code'], webapi: [`${fn} ⏳ pending`] }),
        S('The Promise resolves → “resume async fn” is queued as a microtask', { micro: ['resume async fn'] }),
        S(`The function resumes on the same line with ${v} = resolved value`, { stack: ['async fn()'], mem: [`${v} = { … }`] })
      ]
    };
  }
  if (/\b(setTimeout|setInterval)\s*\(/.test(line)) {
    const ms = nameOf(line, /,\s*(\d+)\s*\)\s*;?\s*$/, '0');
    return {
      kind: 'timer',
      steps: [
        S('setTimeout() is pushed onto the call stack', { stack: ['setTimeout()'] }),
        S(`The browser starts a ${ms} ms timer outside JavaScript; setTimeout returns an id at once`, { webapi: [`timer ${ms} ms ⏱`] }),
        S('The script keeps running — the callback has NOT run yet', { stack: ['next lines…'], webapi: [`timer ${ms} ms ⏱`] }),
        S('Timer done → the callback waits in the task queue', { task: ['callback'] }),
        S('Only when the stack is empty and microtasks are drained, the event loop runs it', { stack: ['callback()'] })
      ]
    };
  }
  if (/\.then\s*\(|Promise\.resolve|queueMicrotask/.test(line)) {
    return {
      kind: 'microtask',
      steps: [
        S('Promise.resolve() creates an already-fulfilled Promise', { stack: ['Promise.resolve()'], mem: ['Promise ✓ fulfilled'] }),
        S('.then() registers the callback — it never runs synchronously', { stack: ['.then()'], micro: ['then-callback'] }),
        S('The rest of the script finishes first', { stack: ['next lines…'], micro: ['then-callback'] }),
        S('Stack empty → ALL microtasks run before any timer task', { stack: ['then-callback()'], task: ['(timers wait)'] })
      ]
    };
  }
  if (/console\.(log|error|warn|info)\s*\(/.test(line)) {
    const arg = nameOf(line, /console\.\w+\((.*)\)\s*;?\s*$/, '…').slice(0, 26);
    return {
      kind: 'log',
      steps: [
        S('The arguments are evaluated first', { stack: [`evaluate ${arg}`] }),
        S('console.log() is pushed onto the stack', { stack: ['console.log()'] }),
        S('The text is handed to the console — then the frame pops', { out: [arg.replace(/^["'`]|["'`]$/g, '')] }),
        S('Execution continues with the next statement', { out: [arg.replace(/^["'`]|["'`]$/g, '')] })
      ]
    };
  }
  if (/^(export\s+)?(async\s+)?function\b/.test(line)) {
    const fn = nameOf(line, /function\s+([\w$]+)/, 'fn');
    return {
      kind: 'function',
      steps: [
        S('Before any code runs, the engine scans the scope (creation phase)'),
        S(`The whole function object is created — hoisted — and bound to ${fn}`, { mem: [`${fn} → ƒ`] }),
        S('The body does NOT run now; it runs each time the function is called', { mem: [`${fn} → ƒ`] })
      ]
    };
  }
  if (/^(const|let|var)\s+[\w$]+\s*=\s*(\([^)]*\)|[\w$]+)\s*=>/.test(line)) {
    const fn = nameOf(line, /(?:const|let|var)\s+([\w$]+)/, 'fn');
    return {
      kind: 'function',
      steps: [
        S('The right-hand side is evaluated: an arrow function object is created', { stack: ['create ƒ'] }),
        S(`It is bound to ${fn} (not hoisted — only usable from this line on)`, { mem: [`${fn} → ƒ`] })
      ]
    };
  }
  if (/addEventListener\s*\(/.test(line)) {
    const ev = nameOf(line, /addEventListener\(\s*['"`](\w+)/, 'event');
    return {
      kind: 'event',
      steps: [
        S('addEventListener() is called', { stack: ['addEventListener()'] }),
        S(`The browser stores the handler for “${ev}” — nothing runs yet`, { webapi: [`${ev} handler 👂`] }),
        S(`A ${ev} happens → the handler is queued as a task`, { webapi: [`${ev} handler 👂`], task: [`${ev} handler`] }),
        S('Stack empty → the event loop runs it', { webapi: [`${ev} handler 👂`], stack: [`${ev} handler()`] })
      ]
    };
  }
  if (/^(const|let|var)\b/.test(line)) {
    const v = nameOf(line, /(?:const|let|var)\s+([\w$]+)/, 'x');
    const call = nameOf(line, /=\s*([\w$.]+)\s*\(/, null);
    return {
      kind: 'declare',
      steps: [
        ...(call ? [S(`${call}() runs first — its frame is pushed`, { stack: [`${call}()`] })] : [S('The right-hand side is evaluated', { stack: ['evaluate'] })]),
        S(`The value is bound to ${v} in the current scope`, { mem: [`${v} = …`] }),
        S(/^const/.test(line) ? `${v} can't be reassigned from here on` : `${v} can be reassigned later`, { mem: [`${v} = …`] })
      ]
    };
  }
  if (/^return\b/.test(line)) {
    return {
      kind: 'call',
      steps: [
        S('The return expression is evaluated inside the current frame', { stack: ['(script)', 'fn()'] }),
        S('The value is handed back to the caller and the frame pops', { stack: ['(script)'] })
      ]
    };
  }
  if (/^[\w$.]+\s*\(.*\)\s*;?$/.test(line)) {
    const fn = nameOf(line, /^([\w$.]+)/, 'fn');
    return {
      kind: 'call',
      steps: [
        S(`${fn}() is called — a new frame with its own locals is pushed`, { stack: ['(script)', `${fn}()`] }),
        S('Its body runs to the end (or to the first await)', { stack: ['(script)', `${fn}()`] }),
        S('The frame pops and control returns here', { stack: ['(script)'] })
      ]
    };
  }
  return { kind: 'parse', steps: [S('The parser turns this line into tokens, then into an AST the engine compiles', { stack: ['(script)'] })] };
};


/* ── HTML ─────────────────────────────────────────────────── */
const HTML_LANES = [
  ['tokens', 'Tokenizer'],
  ['dom', 'DOM tree'],
  ['render', 'Screen · network']
];
const VOID = new Set(['meta', 'link', 'img', 'br', 'hr', 'input', 'source', 'area', 'base', 'col', 'embed', 'track', 'wbr']);
const HEAD_ONLY = new Set(['html', 'head', 'meta', 'title', 'link', 'script', 'style', 'base']);
const ELEMENT_CLASS = {
  a: 'Anchor', p: 'Paragraph', ul: 'UList', ol: 'OList', li: 'LI', img: 'Image', h1: 'Heading', h2: 'Heading', h3: 'Heading',
  h4: 'Heading', h5: 'Heading', h6: 'Heading', br: 'BR', hr: 'HR', textarea: 'TextArea', select: 'Select', option: 'Option', table: 'Table', iframe: 'IFrame'
};
const SIMPLE = new Set(['html', 'head', 'body', 'title', 'meta', 'link', 'script', 'style', 'div', 'span', 'button', 'input', 'form', 'label', 'canvas', 'video', 'audio', 'template', 'base', 'source']);
const elementClass = (name) => {
  if (ELEMENT_CLASS[name]) return `HTML${ELEMENT_CLASS[name]}Element`;
  if (SIMPLE.has(name)) return `HTML${name.charAt(0).toUpperCase()}${name.slice(1)}Element`;
  return 'HTMLElement';
};
const TAG_RE = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>|([^<]+)/g;

// The stack of open elements the parser has when it reaches this line
const openElements = (before) => {
  const stack = [];
  for (const m of before.join('\n').matchAll(TAG_RE)) {
    if (!m[2]) continue;
    const name = m[2].toLowerCase();
    if (m[1]) { const at = stack.lastIndexOf(name); if (at >= 0) stack.length = at; }
    else if (!VOID.has(name) && !m[4]) stack.push(name);
  }
  return stack;
};
const path = (stack, extra = []) => {
  const all = ['document', ...stack.map((t) => `<${t}>`), ...extra];
  return all.length > 4 ? ['…', ...all.slice(-3)] : all;
};

const htmlScene = (raw, before) => {
  const line = (raw || '').trim();
  if (!line || /^<!--/.test(line)) return { kind: 'idle', lanes: HTML_LANES, steps: [S('Nothing is built from this line — the parser skips whitespace and comments.')] };
  if (/^<!doctype/i.test(line)) {
    return {
      kind: 'parse', lanes: HTML_LANES,
      steps: [
        S('The tokenizer reads a DOCTYPE token', { tokens: ['DOCTYPE html'] }),
        S('It is attached to the document — not an element', { dom: ['document', '<!DOCTYPE>'] }),
        S('The browser switches to standards mode (no 1990s “quirks”)', { dom: ['document', '<!DOCTYPE>'], render: ['standards mode ✓'] })
      ]
    };
  }
  const stack = openElements(before);
  const steps = [];
  for (const m of line.matchAll(TAG_RE)) {
    if (m[0].startsWith('<!--')) continue;
    if (m[5] !== undefined) {
      const text = m[5].trim();
      if (!text) continue;
      const parent = stack[stack.length - 1] || 'body';
      steps.push(S(`Character tokens “${text.slice(0, 24)}”`, { tokens: [`"${text.slice(0, 18)}"`], dom: path(stack) }));
      steps.push(S(`They become a Text node inside <${parent}>`, { dom: path(stack, [`"${text.slice(0, 14)}"`]) }));
      continue;
    }
    const name = m[2].toLowerCase();
    if (m[1]) {
      steps.push(S(`End tag </${name}>`, { tokens: [`EndTag </${name}>`], dom: path(stack) }));
      const at = stack.lastIndexOf(name);
      if (at >= 0) stack.length = at;
      steps.push(S(`<${name}> is popped off the stack of open elements — new nodes now go into ${stack.length ? `<${stack[stack.length - 1]}>` : 'the document'}`, { dom: path(stack) }));
      continue;
    }
    const attrs = [...m[3].matchAll(/([\w-:]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/g)].map((a) => a[1]);
    const parent = stack[stack.length - 1];
    steps.push(S(`Start tag <${name}>${attrs.length ? ` with ${attrs.join(', ')}` : ''}`, { tokens: [`StartTag <${name}${attrs.length ? ' …' : ''}>`], dom: path(stack) }));
    steps.push(S(`An ${elementClass(name)} node is created and appended to ${parent ? `<${parent}>` : 'the document'}`, { dom: path(stack, [`<${name}>`]) }));
    if (attrs.length) steps.push(S(`Attributes become properties you can read in JS (${attrs.slice(0, 3).map((a) => (a === 'class' ? 'className' : a)).join(', ')})`, { dom: path(stack, [`<${name}>`]), render: attrs.slice(0, 3).map((a) => `${a} ✓`) }));
    if (name === 'link' && /stylesheet/.test(m[3])) steps.push(S('The stylesheet downloads; rendering waits for it (render-blocking)', { dom: path(stack, ['<link>']), render: ['GET .css ⏳', 'paint blocked'] }));
    if (name === 'script') steps.push(S(/defer|async|module/.test(m[3]) ? 'The script downloads in parallel; parsing continues' : 'The parser pauses until this script has run', { dom: path(stack, ['<script>']), render: [/defer|async|module/.test(m[3]) ? 'GET .js (parallel)' : 'parser paused ⏸'] }));
    if (name === 'img') steps.push(S('The image downloads in parallel; layout reserves space if width/height are set', { dom: path(stack, ['<img>']), render: ['GET image ⏳'] }));
    if (name === 'title') steps.push(S('Its text becomes the tab title', { dom: path(stack, ['<title>']), render: ['tab title ✎'] }));
    if (name === 'meta' && /charset/.test(m[3])) steps.push(S('The bytes are decoded as UTF-8 from here on', { dom: path(stack, ['<meta>']), render: ['decode UTF-8'] }));
    if (VOID.has(name) || m[4]) steps.push(S(`<${name}> is a void element: it has no content and is closed at once`, { dom: path(stack, [`<${name}>`]) }));
    else stack.push(name);
  }
  if (!steps.length) return { kind: 'parse', lanes: HTML_LANES, steps: [S('Text on this line becomes part of a Text node', { dom: path(stack) })] };
  // visible content (anything in <body> that is not a head-only element) ends with rendering
  const visible = [...line.matchAll(TAG_RE)].some((m) => m[2] && !m[1] && !HEAD_ONLY.has(m[2].toLowerCase()) && m[2].toLowerCase() !== 'body');
  if (visible) {
    steps.push(S('Once styles are ready: style → layout → paint — the content appears on screen', { dom: path(stack), render: ['style', 'layout', 'paint ✓'] }));
  }
  return { kind: 'parse', lanes: HTML_LANES, steps };
};

/* ── CSS ──────────────────────────────────────────────────── */
const CSS_LANES = [
  ['match', 'Selector'],
  ['style', 'Computed style'],
  ['render', 'Render pipeline']
];
const LAYOUT = /^(width|height|min-|max-|margin|padding|display|position|top|left|right|bottom|inset|font-size|font-family|font-weight|line-height|flex|grid|gap|border-width|border$|box-sizing|float|overflow|white-space|letter-spacing|text-align|align-|justify-|order|column|row)/;
const PAINT = /^(color|background|border-color|border-style|border-radius|box-shadow|outline|text-decoration|text-shadow|visibility|cursor|fill|stroke)/;
const COMPOSITE = /^(transform|opacity|filter|will-change|backdrop-filter)/;

const currentSelector = (before) => {
  let depth = 0;
  for (let i = before.length - 1; i >= 0; i--) {
    const l = before[i];
    depth += (l.match(/}/g) || []).length;
    const opens = (l.match(/{/g) || []).length;
    if (opens) {
      if (depth === 0) return l.replace(/\{.*$/, '').trim();
      depth -= opens;
    }
  }
  return null;
};

const cssScene = (raw, before) => {
  const line = (raw || '').trim();
  if (!line || /^\/\*/.test(line)) return { kind: 'idle', lanes: CSS_LANES, steps: [S('Nothing to apply — blank lines and comments are skipped.')] };
  if (/^@media/.test(line)) {
    const cond = line.replace(/^@media\s*/, '').replace(/\{.*$/, '').trim();
    return {
      kind: 'parse', lanes: CSS_LANES,
      steps: [
        S(`The condition ${cond} is evaluated against the viewport`, { match: [`@media ${cond}`] }),
        S('Rules inside only apply while it is true', { match: [`@media ${cond}`], style: ['rules: on / off'] }),
        S('Resize or rotate → re-evaluated, styles recalculated, layout runs again', { render: ['recalc style', 'layout', 'paint'] })
      ]
    };
  }
  if (/\{\s*$/.test(line) || /\{.*\}/.test(line)) {
    const sel = line.replace(/\{.*$/, '').trim();
    return {
      kind: 'parse', lanes: CSS_LANES,
      steps: [
        S(`The parser reads the selector ${sel}`, { match: [sel] }),
        S('A rule is added to the CSSOM (the CSS object model)', { match: [sel], style: ['CSSOM rule +1'] }),
        S('Matching runs right to left: the browser checks each element against the last part first', { match: [sel, '↳ matching elements'] }),
        S('Its declarations will apply to every matching element', { match: [sel, '↳ matching elements'], style: ['declarations…'] })
      ]
    };
  }
  if (/^}/.test(line)) return { kind: 'parse', lanes: CSS_LANES, steps: [S('The rule ends; it is now part of the CSSOM', { style: ['CSSOM rule ✓'] })] };
  const m = line.match(/^(--[\w-]+|[\w-]+)\s*:\s*([^;]*);?/);
  if (!m) return { kind: 'parse', lanes: CSS_LANES, steps: [S('The CSS parser reads this line as part of the current rule')] };
  const [, prop, value] = m;
  const sel = currentSelector(before) || 'this rule';
  const steps = [
    S(`Declaration ${prop}: ${value.trim()} joins ${sel}`, { match: [sel], style: [`${prop}: ${value.trim()}`.slice(0, 30)] }),
    S(prop.startsWith('--')
      ? 'A custom property: stored as-is, resolved wherever var() reads it'
      : 'Cascade: specificity and source order decide whether this value wins', { match: [sel], style: [`${prop}: ${value.trim()}`.slice(0, 30), prop.startsWith('--') ? 'inherits ↓' : 'winner?'] })
  ];
  const p = prop.toLowerCase();
  if (/!important/.test(value)) steps.push(S('!important jumps it above normal declarations — use sparingly', { style: [`${prop} !important`] }));
  if (COMPOSITE.test(p)) steps.push(S('Changing it only needs the compositor (often on the GPU) — the cheapest path, ideal for animation', { style: ['computed ✓'], render: ['composite'] }));
  else if (PAINT.test(p)) steps.push(S('Changing it repaints pixels but skips layout — geometry does not change', { style: ['computed ✓'], render: ['paint', 'composite'] }));
  else if (LAYOUT.test(p)) steps.push(S('It affects geometry: layout (reflow) → paint → composite — the most expensive path', { style: ['computed ✓'], render: ['layout ⟳', 'paint', 'composite'] }));
  else if (/^(transition|animation)/.test(p)) steps.push(S('Registers how changes should animate over time', { style: ['animation ✓'], render: ['frames ▶'] }));
  else steps.push(S('The computed value is stored on each matching element', { style: ['computed ✓'] }));
  return { kind: 'parse', lanes: CSS_LANES, steps };
};

const SPEEDS = [1, 0.5];

export const BtsSimulation = ({ line, language = 'javascript', before = [], showSteps = false }) => {
  const scene = useMemo(() => {
    const sc = sceneFor(line, language, before);
    return { lanes: JS_LANES, ...sc };
  }, [line, language, before]);
  const reduced = usePrefersReducedMotion();
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(!reduced);
  const [speed, setSpeed] = useState(1);
  useEffect(() => { setI(0); }, [scene]);
  useEffect(() => setPlaying(!reduced), [reduced]);
  useEffect(() => {
    if (!playing || scene.steps.length < 2) return undefined;
    const base = i === scene.steps.length - 1 ? 2200 : 1300;
    const t = setTimeout(() => setI((x) => (x + 1) % scene.steps.length), base / speed);
    return () => clearTimeout(t);
  }, [playing, i, scene, speed]);

  const at = Math.min(i, scene.steps.length - 1);
  const step = scene.steps[at];
  const go = (n) => { setPlaying(false); setI((n + scene.steps.length) % scene.steps.length); };
  return (
    <div className={`sim is-${scene.kind} ${scene.lanes.length === 3 ? 'is-three' : ''}`} aria-label="Simulation of what happens behind the scenes">
      <div className="sim-lanes">
        {scene.lanes.map(([id, label]) => (
          <div key={id} className={`sim-lane ${step[id]?.length ? 'is-active' : ''}`}>
            <span className="sim-lane-label mono">{label}</span>
            <div className={`sim-lane-body ${id === 'stack' ? 'is-stack' : ''}`}>
              {(step[id] || []).map((chip, k) => (
                <span key={`${at}-${k}-${chip}`} className={`sim-chip is-${id}`} style={id === 'dom' ? { marginLeft: `${Math.min(k, 4) * 8}px` } : undefined}>{chip}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="sim-foot">
        <p className="sim-caption" aria-live="polite"><span className="mono">{at + 1}/{scene.steps.length}</span> {step.caption}</p>
        {scene.steps.length > 1 && (
          <div className="sim-controls">
            <button className="icon-btn is-quiet" onClick={() => go(at - 1)} aria-label="Previous step"><ChevronLeft size={14} /></button>
            <button className="icon-btn is-quiet" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause simulation' : 'Play simulation'}>{playing ? <Pause size={13} /> : <Play size={13} />}</button>
            <button className="icon-btn is-quiet" onClick={() => go(at + 1)} aria-label="Next step"><ChevronRight size={14} /></button>
            {showSteps && (
              <button
                className="sim-speed mono"
                onClick={() => setSpeed((v) => SPEEDS[(SPEEDS.indexOf(v) + 1) % SPEEDS.length])}
                aria-label={`Playback speed ${speed}×, change`}
                title="Playback speed"
              >
                {speed === 1 ? '1×' : '½×'}
              </button>
            )}
          </div>
        )}
      </div>
      {showSteps && scene.steps.length > 1 && (
        <ol className="sim-steps" aria-label="All steps">
          {scene.steps.map((st, k) => (
            <li key={k}>
              <button className={`sim-step ${k === at ? 'is-current' : ''} ${k < at ? 'is-done' : ''}`} onClick={() => go(k)} aria-current={k === at ? 'step' : undefined}>
                <span className="sim-step-n mono">{k + 1}</span>
                <span>{st.caption}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};
