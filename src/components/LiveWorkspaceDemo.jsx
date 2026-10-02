import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, Check, ArrowUpRight } from 'lucide-react';
import { CodeEditor } from './CodeEditor';
import { explainLine } from '../lib/explain';
import { engineSyntaxError } from '../lib/diagnostics';
import { buildDocument } from '../lib/sandbox';
import { lensTarget, linkMap } from '../lib/lens';

const STARTER = [
  {
    id: 'html',
    name: 'index.html',
    language: 'html',
    code: `<main class="card">
  <h1>Hello, Monklogy</h1>
  <p class="lead">Hover me, then look at the code.</p>
  <button id="like">♥ Like</button>
  <p id="count">0 likes</p>
</main>`
  },
  {
    id: 'css',
    name: 'style.css',
    language: 'css',
    code: `body {
  font-family: system-ui, sans-serif;
  background: #f6f3ee;
  padding: 24px;
}
.card {
  background: white;
  border-radius: 14px;
  padding: 20px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08);
}
h1 {
  margin: 0 0 8px;
  color: #c2410c;
}
.lead {
  color: #555;
}
#like {
  border: 0;
  padding: 8px 16px;
  border-radius: 999px;
  background: #c2410c;
  color: white;
  cursor: pointer;
}`
  },
  {
    id: 'js',
    name: 'script.js',
    language: 'javascript',
    code: `const button = document.querySelector('#like');
const count = document.getElementById('count');
let likes = 0;

button.addEventListener('click', () => {
  likes = likes + 1;
  count.textContent = likes + ' likes';
});`
  }
];

// What each file is for, in a beginner's words, and the colour that ties
// its lines to the page.
const ROLE = {
  html: { key: 'html', short: 'HTML', role: 'Structure', verb: 'Built', color: '#d9622b' },
  css: { key: 'css', short: 'CSS', role: 'Style', verb: 'Styled', color: '#5b5bd6' },
  javascript: { key: 'js', short: 'JS', role: 'Behaviour', verb: 'Made interactive', color: '#b7791f' }
};
const PICK_COLOR = '#2563eb';

const STEPS = [
  { id: 'code', text: 'Hover a line of code' },
  { id: 'page', text: 'Hover something on the page' },
  { id: 'edit', text: 'Change the code and watch it update' }
];

/* "line 4" · "lines 1, 5–7" */
const lineList = (nums) => {
  const out = [];
  [...nums].sort((a, b) => a - b).forEach((n) => {
    const last = out[out.length - 1];
    if (last && n === last[1] + 1) last[1] = n;
    else out.push([n, n]);
  });
  const text = out.map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`)).join(', ');
  return `${nums.length === 1 ? 'line' : 'lines'} ${text}`;
};

/**
 * The Lobby's hands-on demo: HTML, CSS and JavaScript beside a live page,
 * linked both ways. Hover a line → it is highlighted on the page. Hover the
 * page → the lines that build, style and drive that element are highlighted.
 */
export const LiveWorkspaceDemo = () => {
  const [files, setFiles] = useState(STARTER);
  const [activeId, setActiveId] = useState('html');
  const [hover, setHover] = useState(null);
  const [pick, setPick] = useState(null); // { tag, html, css, js } from the page
  const [error, setError] = useState(null);
  const [frame, setFrame] = useState({ html: '', key: 0 });
  const [done, setDone] = useState(() => new Set());
  const iframeRef = useRef(null);
  const editorRef = useRef(null);
  const runId = useRef(0);

  const active = files.find((f) => f.id === activeId);
  const activeRole = ROLE[active.language];
  const setCode = (code) => setFiles((fs) => fs.map((f) => (f.id === activeId ? { ...f, code } : f)));
  const markDone = (id) => setDone((d) => (d.has(id) ? d : new Set(d).add(id)));

  // Live page: rebuild shortly after every edit
  useEffect(() => {
    const t = setTimeout(() => {
      runId.current += 1;
      const js = files.find((f) => f.language === 'javascript').code;
      const syntax = engineSyntaxError(js);
      setError(syntax ? `script.js has a mistake: ${syntax}` : null);
      const doc = buildDocument(files, runId.current, { lens: true, linkMap: linkMap(files), executeJs: !syntax });
      setFrame((f) => ({ html: doc.html, key: f.key + 1 }));
    }, 300);
    if (files !== STARTER) markDone('edit');
    return () => clearTimeout(t);
  }, [files]);

  // Messages from the page: hovered element and runtime errors
  useEffect(() => {
    const onMsg = (e) => {
      if (!iframeRef.current || e.source !== iframeRef.current.contentWindow || !e.data?.__monklogy) return;
      const d = e.data;
      if (d.run !== runId.current) return;
      if (d.type === 'pick' && d.html) {
        setPick({ tag: d.tag.split(/[#.]/)[0], html: [d.html], css: d.css, js: d.js });
        markDone('page');
      }
      if (d.type === 'runtime') setError(d.text);
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  // Code → page: highlight what the hovered line points at
  const target = useMemo(
    () => (hover === null ? null : lensTarget({ code: active.code, lineIndex: hover, language: active.language })),
    [hover, active.code, active.language]
  );
  useEffect(() => {
    if (hover !== null) {
      setPick(null);
      markDone('code');
    }
    iframeRef.current?.contentWindow?.postMessage(
      { __monklogyLens: true, id: 0, run: runId.current, line: target?.line, selector: target?.selector, color: activeRole.color },
      '*'
    );
  }, [hover, target?.line, target?.selector, frame.key]); // eslint-disable-line react-hooks/exhaustive-deps

  // Page → code: highlight the linked lines in the open file
  const marks = pick ? (pick[activeRole.key] || []).map((n) => n - 1) : [];
  useEffect(() => {
    if (marks.length) editorRef.current?.revealLine(marks[0]);
  }, [pick, activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const explanation = useMemo(
    () => (hover === null ? null : explainLine({ code: active.code, lineIndex: hover, language: active.language })),
    [hover, active.code, active.language]
  );
  const hoveredText = hover === null ? '' : active.code.split('\n')[hover]?.trim();

  const reset = () => {
    setFiles(STARTER);
    setPick(null);
    setDone(new Set());
  };

  // The panel under the page: always says one useful thing
  let panel;
  if (pick) {
    const rows = files
      .map((f) => ({ f, r: ROLE[f.language], lines: pick[ROLE[f.language].key] || [] }))
      .filter((x) => x.lines.length);
    panel = (
      <div className="lwd-explain" key={`pick-${pick.html[0]}`}>
        <p className="lwd-explain-title">This is the <code>&lt;{pick.tag}&gt;</code> element.</p>
        <ul className="lwd-links">
          {rows.map(({ f, r, lines }) => (
            <li key={f.id}>
              <button className={f.id === activeId ? 'is-active' : ''} style={{ '--lc': r.color }} onClick={() => setActiveId(f.id)}>
                <span className="lwd-dot" aria-hidden="true" />
                <span className="lwd-links-verb">{r.verb}</span>
                <span className="lwd-links-where mono">{f.name} · {lineList(lines)}</span>
                {f.id !== activeId && <ArrowUpRight size={13} className="lwd-links-go" aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  } else if (explanation && hoveredText) {
    panel = (
      <div className="lwd-explain" key={`line-${activeId}-${hover}`}>
        <p className="lwd-explain-meta mono" style={{ '--lc': activeRole.color }}>
          <span className="lwd-dot" aria-hidden="true" /> {activeRole.short} · line {hover + 1}
        </p>
        <p className="lwd-explain-title">{explanation.title}</p>
        {explanation.says && <p className="lwd-explain-text">{explanation.says}</p>}
        <p className="lwd-explain-note">
          {target ? 'Highlighted on the page above.' : 'This line has no visible part on the page by itself.'}
        </p>
      </div>
    );
  } else {
    panel = (
      <div className="lwd-explain is-empty">
        <p className="lwd-explain-text">
          Hover a line of code to see what it does on the page — or hover the page to find the code behind it.
        </p>
      </div>
    );
  }

  return (
    <div className="lwd-wrap">
      <ol className="lwd-steps" aria-label="Try it">
        {STEPS.map((s, i) => {
          const isDone = done.has(s.id);
          const isNext = !isDone && STEPS.slice(0, i).every((p) => done.has(p.id));
          return (
            <li key={s.id} className={`${isDone ? 'is-done' : ''} ${isNext ? 'is-next' : ''}`}>
              <span className="lwd-step-n" aria-hidden="true">{isDone ? <Check size={12} strokeWidth={3} /> : i + 1}</span>
              {s.text}
              {isDone && <span className="sr-only"> (done)</span>}
            </li>
          );
        })}
      </ol>

      <div className="lwd">
        <div className="lwd-editor" style={{ '--link': activeRole.color }}>
          <div className="lwd-bar">
            <div className="lwd-tabs" role="tablist" aria-label="Files">
              {files.map((f) => {
                const r = ROLE[f.language];
                const linked = pick && f.id !== activeId ? (pick[r.key] || []).length : 0;
                return (
                  <button
                    key={f.id}
                    role="tab"
                    aria-selected={f.id === activeId}
                    className={`lwd-file ${f.id === activeId ? 'is-active' : ''}`}
                    style={{ '--lc': r.color }}
                    onClick={() => setActiveId(f.id)}
                  >
                    <span className="lwd-dot" aria-hidden="true" />
                    <span className="mono">{f.name}</span>
                    <span className="lwd-file-role">{r.role}</span>
                    {linked > 0 && <span className="lwd-badge" aria-label={`${linked} linked lines`}>{linked}</span>}
                  </button>
                );
              })}
            </div>
            <button className="btn btn-ghost btn-sm lwd-reset" onClick={reset} title="Restore the example">
              <RotateCcw size={13} /> <span className="lwd-reset-label">Reset</span>
            </button>
          </div>
          <CodeEditor
            ref={editorRef}
            key={activeId}
            value={active.code}
            onChange={setCode}
            fileName={active.name}
            onHoverLine={setHover}
            hoverText
            marks={marks}
            label={`${active.name} — hover a line to see it on the page`}
          />
        </div>

        <div className="lwd-preview">
          <div className="lwd-bar is-light">
            <span className="lwd-preview-title">Your page</span>
            <span className="lwd-live mono"><span aria-hidden="true" /> Live</span>
          </div>
          <iframe
            key={frame.key}
            ref={iframeRef}
            srcDoc={frame.html}
            title="Live page built from the code"
            sandbox="allow-scripts"
            className="lwd-frame"
          />
          {error && <p className="lwd-error" role="alert">{error}</p>}
          <div className="lwd-panel" aria-live="polite" style={{ '--pick': PICK_COLOR }}>{panel}</div>
        </div>
      </div>
    </div>
  );
};
