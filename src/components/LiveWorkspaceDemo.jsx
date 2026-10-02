import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Play, RotateCcw, MousePointer2 } from 'lucide-react';
import { CodeEditor } from './CodeEditor';
import { Terminal } from './Terminal';
import { BtsSimulation } from './BtsSimulation';
import { explainLine } from '../lib/explain';
import { diagnose, engineSyntaxError } from '../lib/diagnostics';
import { buildDocument } from '../lib/sandbox';

const STARTER = `function fetchUser() {
  return new Promise((resolve) => setTimeout(() => resolve({ name: "Ada" }), 300));
}
const greet = (name) => \`Hello, \${name}\`;

console.log("1 · script starts");
setTimeout(() => console.log("4 · timer fired"), 0);
Promise.resolve().then(() => console.log("3 · microtask ran"));

async function load() {
  const user = await fetchUser();
  console.log(greet(user.name));
}
load();
console.log("2 · script ends");`;

const DEFAULT_LINE = 10; // "const user = await fetchUser();"

/**
 * The Lobby's hands-on demo: a real editor, a real sandboxed run with an
 * interactive terminal, and a behind-the-scenes panel that explains and
 * simulates whichever line you hover (or put the cursor on).
 */
export const LiveWorkspaceDemo = () => {
  const [code, setCode] = useState(STARTER);
  const [cursor, setCursor] = useState({ start: DEFAULT_LINE, end: DEFAULT_LINE });
  const [hover, setHover] = useState(null);
  const [term, setTerm] = useState([
    { type: 'dim', text: 'Monklogy sandbox · try: run · help · or any JavaScript, e.g. 2 ** 10' }
  ]);
  const [status, setStatus] = useState({ state: 'idle', errors: 0, warnings: 0 });
  const [frame, setFrame] = useState({ html: '', key: 0 });
  const iframeRef = useRef(null);
  const run = useRef({ id: 0, started: 0, errors: 0, finished: true, jsStartLine: 0 });
  const evalId = useRef(0);

  const lines = code.split('\n');
  const activeLine = Math.min(hover ?? cursor.start, lines.length - 1);
  const explanation = useMemo(() => explainLine({ code, lineIndex: activeLine, language: 'javascript' }), [code, activeLine]);
  const diagnostics = useMemo(() => diagnose(code, 'javascript'), [code]);
  const print = useCallback((...l) => setTerm((t) => [...t, ...l].slice(-120)), []);

  const finish = useCallback((ok, errors) => {
    const r = run.current;
    if (r.finished) return;
    r.finished = true;
    const ms = Math.round(performance.now() - r.started);
    setStatus({ state: ok ? 'ok' : 'failed', errors, warnings: 0, ms });
    print(ok ? { type: 'success', text: `Process exited with code 0 · ${ms} ms` } : { type: 'error', text: `Process exited with code 1 · ${errors} error${errors === 1 ? '' : 's'}` });
  }, [print]);

  const runCode = useCallback(() => {
    const r = run.current;
    r.id += 1;
    r.started = performance.now();
    r.errors = 0;
    r.finished = false;
    print({ type: 'cmd', text: 'node script.js' });
    const engine = engineSyntaxError(code);
    const errs = diagnostics.filter((d) => d.severity === 'error');
    if (engine || errs.length) {
      errs.forEach((d) => print({ type: 'error', text: d.message, loc: { file: 'script.js', line: d.line, col: d.col } }));
      if (engine && !errs.length) print({ type: 'error', text: `SyntaxError: ${engine}` });
      print({ type: 'error', text: 'Build failed — script.js was not executed.' });
      finish(false, Math.max(1, errs.length));
      return;
    }
    const doc = buildDocument([{ language: 'javascript', code }], r.id);
    r.jsStartLine = doc.jsStartLine;
    setFrame((f) => ({ html: doc.html, key: f.key + 1 }));
    setStatus({ state: 'running', errors: 0, warnings: 0 });
  }, [code, diagnostics, print, finish]);

  useEffect(() => {
    const onMsg = (e) => {
      if (!iframeRef.current || e.source !== iframeRef.current.contentWindow || !e.data?.__monklogy) return;
      const d = e.data;
      const r = run.current;
      if (d.run !== r.id) return;
      if (d.type === 'done') {
        // wait for timers / promises in the snippet (it uses a 300 ms timer)
        setTimeout(() => finish(r.errors === 0, r.errors), 700);
        return;
      }
      if (d.type === 'runtime') {
        r.errors += 1;
        const line = d.lineno ? d.lineno - r.jsStartLine + 1 : null;
        print({ type: 'error', text: d.text, loc: line && line > 0 ? { file: 'script.js', line, col: d.colno } : undefined });
        return;
      }
      if (d.type === 'result') return print({ type: 'result', text: d.text });
      if (d.type === 'evalerror') return print({ type: 'error', text: d.text });
      print({ type: d.type === 'warn' ? 'warn' : d.type === 'error' ? 'error' : 'log', text: d.text });
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [print, finish]);

  const onCommand = (raw) => {
    const cmd = raw.trim();
    if (cmd === 'clear' || cmd === 'cls') { setTerm([]); return; }
    if (cmd === 'run' || cmd === 'node script.js') { runCode(); return; }
    print({ type: 'cmd', text: raw });
    if (cmd === 'help') {
      print({ type: 'dim', text: 'run     execute script.js in the sandbox' }, { type: 'dim', text: 'clear   clear the terminal' }, { type: 'dim', text: 'other   evaluated as JavaScript in the sandbox page' });
      return;
    }
    if (!iframeRef.current?.contentWindow || !frame.html) {
      print({ type: 'dim', text: 'Starting the sandbox… run the script once, then try again.' });
      runCode();
      return;
    }
    evalId.current += 1;
    iframeRef.current.contentWindow.postMessage({ __monklogyEval: true, id: evalId.current, code: raw }, '*');
  };

  return (
    <div className="lwd">
      <div className="lwd-editor">
        <div className="lwd-bar">
          <span className="lwd-file mono">script.js</span>
          <span className="lwd-hint mono"><MousePointer2 size={12} /> hover any line</span>
          <div className="lwd-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setCode(STARTER)} title="Restore the example"><RotateCcw size={13} /> Reset</button>
            <button className="btn btn-accent btn-sm" onClick={runCode}><Play size={13} fill="currentColor" /> Run</button>
          </div>
        </div>
        <CodeEditor
          value={code}
          onChange={setCode}
          fileName="script.js"
          onCursorChange={setCursor}
          onHoverLine={setHover}
          hoverText
          diagnostics={diagnostics}
          label="Example code — hover or move the cursor to inspect a line"
        />
        <Terminal
          lines={term}
          status={status}
          cwd="~/demo"
          onCommand={onCommand}
          onClear={() => setTerm([])}
          onJump={() => {}}
          placeholder="run · help · or type JavaScript"
        />
        <iframe key={frame.key} ref={iframeRef} srcDoc={frame.html} title="Sandbox" sandbox="allow-scripts" className="lwd-sandbox" tabIndex={-1} aria-hidden="true" />
      </div>

      <aside className="lwd-bts" aria-label="Behind the scenes">
        <p className="lwd-bts-k mono">Behind the scenes · line {activeLine + 1}{hover !== null ? ' · hover' : ''}</p>
        <pre className="lwd-line"><code>{lines[activeLine]?.trim() || ' '}</code></pre>
        <h3 className="lwd-title" key={explanation.title}>{explanation.title}</h3>
        <BtsSimulation line={lines[activeLine]} />
        <p className="lwd-runtime">{explanation.runtime}</p>
        <p className="lwd-note mono">A teaching model of the event loop · explanations come from recognised language patterns.</p>
      </aside>
    </div>
  );
};
